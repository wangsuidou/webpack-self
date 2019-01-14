#! /usr/local/bin/node

//user/bin/env
const path = require("path");
const fs = require('fs');
const root = process.cwd()//获取当前工作目录
let configPath = path.join(root,'webpack.config.js')//获取默认webpack config文件
let config = require(configPath)
const Complier = require('../lib/Complier')//引入Complier方法
let complier = new Complier(config)//实例化complier(编译）对象
//发射entryOptions事件
complier.hooks.entryOption.call(config)
complier.run();//执行编译