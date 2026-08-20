const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.blockList = [
  /Yureka\.One\/index\.tsx$/,
  /Yureka\.One\/App\.tsx$/,
  /Yureka\.One\/app\//,
  /Yureka\.One\/landing\//,
  /Yureka\.One\/backend\//,
  /Yureka\.One\/shared\//,
  /Yureka\.One\/dist\//,
]

module.exports = config
