// Tagging for lit-html: https://marketplace.visualstudio.com/items?itemName=bierner.lit-html
export default function joinTemplateLiteral(strings, ...args) {
  let result = "";
  for (let x = 0; x < strings.length; x++) {
    result += strings[x];
    const arg = args[x];
    if (arg) {
      result += arg;
    }
  }

  return result;
}
