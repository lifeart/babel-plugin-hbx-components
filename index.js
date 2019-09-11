
const { preprocess, print, Walker } = require('@glimmer/syntax');

module.exports = function(babel) {
  const { types: t } = babel;
  let templateString = null;
  return {
    parserOverride(a, b, c) {
      if (!a.includes('<template')) {
        return c(a, b);
      }
      // if (!b.sourceFileName.endsWith('.ghbs')) {
      //   return c(a, b);
      // }
      let ast = null;
      try {
        ast = preprocess(a);
      } catch(e) {
        return c(a, b);
      }
      let walker = new Walker();
      let code = '';
      let template = null;
      walker.visit(ast, function(node) {
        if (node.type === 'ElementNode') {
          if (node.tag === 'script') {
            code = node.children[0].chars;
          } else if (node.tag === 'template') {
            template = {
              type: 'Template',
              body: node.children,
              blockParams: []
            }
          }
        }
      });
      templateString = print(template);
      return c(code, b);
    },
    name: 'babel-plugin-hbx-components',
    manipulateOptions({ parserOpts }) {
      parserOpts.plugins.push(['classProperties']);
    },
    visitor: {
      Program(programPath) {
        programPath.traverse({
          ExportDefaultDeclaration(path) {

            if (path.node.declaration.type !== 'ClassDeclaration') {
              return;
            }
            if (path.node.declaration.superClass === null) {
              return;
            }

            if (path.node.declaration.body.body.filter((el)=>{
              return el.type === 'ClassProperty' && el.static === true && el.key.type === 'Identifier' && el.key.name === 'template'
            }).length) {
              return;
            }

            const prop = t.classProperty(t.identifier('template'), t.taggedTemplateExpression(
                t.identifier('hbs'), t.templateLiteral([t.templateElement({ raw: templateString, cooked: templateString})], [])
            ));
            prop.static = true;
            prop.computed = false;
            path.node.declaration.body.body.push(prop);
          }
        });
      },
    },
  };
};
