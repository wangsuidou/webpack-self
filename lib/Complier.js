const fs = require('fs')
const path = require('path')
const esprima = require('esprima')
const estraverse = require('estraverse')
const escodegen = require('escodegen')
const ejs = require('ejs')

const { SyncHook } = require('tapable');
class Complier{
    constructor(options){
        this.options = options;//webpack配置参数
        this.hooks = {
            entryOption:new SyncHook(['config']),
            afterPlugins:new SyncHook(['config']),
            run:new SyncHook('config'),
            compile:new SyncHook(['config']),
            afterCompile:new SyncHook(['config']),
            emit:new SyncHook(['config']),
            done:new SyncHook(['config'])
        }
        let plugins = options.plugins;
        if(plugins.length){
            plugins.forEach(plugin => {
                plugin.apply(this)
            });
        }
       
        //触发插件挂载完成事件
        this.hooks.afterPlugins.call(this)
    }
    //找到入口文件进行编译
    run(){
        this.hooks.run.call(this);
        let {entry,
            output:{path:dist,fileName},
            module:{rules},
            resolveLoaders:{modules:loaderPath}
        } = this.options;
        //取得当前工作目录
        let root = process.cwd();
         //获取入口文件的绝对路径
        let entryPath = path.join(root,entry)
        let entryId //ejs模板中的入口文件路径
        let modules = {}//存放所有模块，moduleId的对应的源码
        this.hooks.compile.call(this);
        parseModule(entryPath,true);
        this.hooks.afterCompile.call(this);

        //模板编译
        console.log("start compiling")
        let bundle = ejs.compile(fs.readFileSync(path.join(__dirname,'main.ejs'),'utf8'))({
            modules,entryId
        })
        //文件写入
        this.hooks.emit.call(this);
        // console.log(11,1111,dist,fileName)
        fs.writeFileSync(path.join(dist,fileName),bundle)
        this.hooks.done.call(this)

        function parseModule(modulePath,isEntry){

             //读取入口文件的文件内容
             let source = fs.readFileSync(modulePath,'utf-8');

             //获取webpack配置文件中的loader
             for(let i =0;i<rules.length;i++){
                 let rule = rules[i]
                 if(rule.test.test(modulePath)){
                    let loaders= rule.use|| rule.loader;
                    console.log(loaders)
                    if(typeof loaders =='string'){

                    }else if(loaders instanceof Array){
                        for(let j=loaders.length-1;j>=0;j--){
                            let loader = loaders[j]
                            // console.log( root,loaderPath,loader)
                            console.log(loader,1111)
                            loader = require(path.join(root,loaderPath,loader))
                            console.log(loader,2222)

                            source = loader(source)
                        }
                    }else if(typeof loaders == 'object'){
                        loader = loaders.loader
                    }
                 }
             }
             //获取文件相对路径
             //   Users/***/Documents/frontend/webpack-self-app  
            //    Users/***/Documents/frontend/webpack-self-app/src/index.js
             let parentPath = path.relative(root,modulePath) //    src/index.js
             //TODO 执行loader进行转换

             //解析模块内容并且返回依赖的模块
             let result = parse(source,path.dirname(parentPath))
             modules['./'+parentPath] = result.source
             if(isEntry) entryId = './'+parentPath
             //递归解析各模块内容和依赖
             let requires = result.requires
             if(requires && requires.length){
                requires.forEach(require => parseModule(path.join(root,require)),false)
             }
        }
        function parse(source,parentPath){
            //生成AST
            let ast = esprima.parse(source)
            let requires = []
            //遍历抽象语法树，找到各模块依赖的模块，替换原模块中的加载路径(https://astexplorer.net/)
            estraverse.replace(ast,{
                enter(node,parent){
                    if(node.type == 'CallExpression'  && node.callee.name =='require'){
                        
                        let name = node.arguments[0].value; //原模块路径（通过查看ast）
                        //获取新的模块路径（通过原模块在当前工作目录中的路径获得）./a/a1= > ./src/a/a1.js
                        name += name.lastIndexOf('.') != 0?'':'.js'
                        let moduelId = './'+path.join(parentPath,name);   //src/a/a1 => ./src/a/a1.js
                        // console.log(moduelId)
                        requires.push(moduelId)
                        node.arguments = [{type:'Literal',value:moduelId}]//修改ast中每个模块路径node节点

                        return node;//返回新的ast节点
                    }
                }
            })
            source = escodegen.generate(ast)
            return {requires,source} //requires是模块的依赖，source是模块的源码
        }
       

    }
}

module.exports = Complier;