const path = require("path");
const babylon = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const DepState = require("./depState");
const { errorLog } = require("./log");

const {
  importPathTransform,
  getAbsolutePath,
  isJsFilePath,
  getPathHead,
} = require("./pathAnalyse");
const { getFileDesc } = require("./commentBlock");
const matchLoad = require("./load");

function parse(codeStr) {
  return babylon.parse(codeStr, {
    sourceType: "module",
    plugins: ["jsx", "classProperties", "typescript"],
  });
}

function getCodeAst(filePath) {
  // 判断文件后缀
  return parse(matchLoad(filePath));
}

function getBranchDiffDep(fileDepData, branchDiffData, repoDirPath) {
  const branchDiffFiles = branchDiffData.files;
  const BranchDiffDep = [];
  for (const branchDiffFile of branchDiffFiles) {
    branchDiffFile.file = branchDiffFile.file.replace(/\//g, path.sep);
    if (Reflect.has(fileDepData, branchDiffFile.file)) {
      BranchDiffDep.push({
        ...branchDiffFile,
        ...fileDepData[branchDiffFile.file],
        file: branchDiffFile.file,
      });
    }
  }
  return BranchDiffDep;
}

class FileDepAnalyse {
  constructor(options) {
    this.repoDirPath = options.repoDirPath;
    this.entry = options.entry;
    this.dependencies = options.dependencies;
    this.alias = this.transformAlias(options.alias);

    this.depState = new DepState(this.repoDirPath);
    this.cover = options.cover;
  }

  getFileDep() {
    return new Promise((resolve, reject) => {
      try {
        const entryFilePath = getAbsolutePath(this.repoDirPath, this.entry);
        const ast = getCodeAst(entryFilePath);
        const fileDesc = getFileDesc(ast, entryFilePath);

        this.depState.addDep(entryFilePath, fileDesc);
        this.getDep(ast, entryFilePath);
        setTimeout(() => {
          // 延时5s等待所有依赖文件扫描完毕再resolve
          resolve(this.depState.state);
        }, 5000);
        console.log("正在扫描文件,请稍等...");
      } catch (error) {
        console.log(error);
      }
    });
  }

  getDep(ast, curFilePath) {
    const _this = this;
    // TODO: 解决循环引用问题，a引用b，b又引用a的情况
    traverse(ast, {
      ImportDeclaration({ node }) {
        // TODO: 使用async await
        const depFilePath = node.source.value;
        _this.mouduleAnalyse(curFilePath, depFilePath);
      },
      // 异步模块解析：import('@views/system/index.jsx')
      CallExpression({ node }) {
        if (node.callee.type === "Import") {
          const depFilePath = node.arguments[0].value;
          _this.mouduleAnalyse(curFilePath, depFilePath);
        }
      },
    });
  }

  mouduleAnalyse(curFilePath, depFilePath) {
    const curPath = path.dirname(curFilePath);
    const pathHead = getPathHead(depFilePath);
    if (this.dependencies.includes(pathHead)) {
      // 公共依赖库不需要进行解析
      return;
    }

    importPathTransform(curPath, depFilePath, this.alias)
      .then((filePath) => {
        if (!filePath) return;
        let fileDesc = {};
        if (!this.depState.hasFileState(filePath)) {
          // 没被解析过的文件，才需要进行解析
          if (isJsFilePath(filePath)) {
            // 如果是js、vue、jsx，继续进行依赖分析
            const codeAst = getCodeAst(filePath);

            fileDesc = getFileDesc(codeAst, filePath);
            this.getDep(codeAst, filePath);
          }
        }
        // TODO: 可以对其他类型的文件进行解析，获取一些描述
        this.depState.addDep(filePath, fileDesc, curFilePath);
      })
      .catch(() => {
        errorLog({
          curFilePath,
          depFilePath,
          pathHead,
          msg: "路径解析错误",
        });
      });
  }

  transformAlias(alias) {
    const aliasTmp = {};
    for (const [key, value] of Object.entries(alias)) {
      if (path.isAbsolute(value)) {
        aliasTmp[key] = value;
      } else {
        aliasTmp[key] = path.join(this.repoDirPath, value);
      }
    }
    return aliasTmp;
  }
}

module.exports = { FileDepAnalyse, getBranchDiffDep };
