//abc_def 转换成 AbcDef
function convertToCamelCase(str) {
  return str.split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// AbcDef 转换成 abcDef
function lowerCaseFirstLetter(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function formatCode(text) {
  if (!text) {
    return text;
  }
  let lines = text.split("\n").map(it => it.trimEnd())
  return lines.join("\n").replace(/[\n]{2,}/g, "\n\n").trim();
}

export { convertToCamelCase, lowerCaseFirstLetter, formatCode }