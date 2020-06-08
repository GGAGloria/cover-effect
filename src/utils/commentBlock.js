function getCommentBlock(comments) {
  const commentBlock = comments.find((comment) => {
    if (comment.type !== 'CommentBlock') return false
    const value = comment.value
    // TODO: 这里应该是个变量，默认值为@Description
    return value.includes('@Description')
  })
  return commentBlock ? commentBlock.value : undefined
}

function compileCommentBlock(commentBlock) {
  // 是否采用key，value的形式
  const descStrList = commentBlock.replace(/\*|\s/g, '').match(/@([^@]+)/g)
  const descObjList = descStrList.map((descStr) => {
    const index = descStr.indexOf(':')
    const key = descStr.substring(1, index)
    const val = descStr.substring(index+1)
    return {
      [key]: val,
    }
  })
  return arr2obj(descObjList)
}

function arr2obj(arr) {
  const tmpObj ={}
  for (const iterator of arr) {
    Object.assign(tmpObj,iterator)
  }
  return tmpObj
}

function getFileDesc(ast) {
  const fileDescStr = getCommentBlock(ast.comments)
  return compileCommentBlock(fileDescStr)
}


module.exports = {
  getCommentBlock,
  compileCommentBlock,
  getFileDesc
}