/* global  Template7, formatBytes */

/* exported parseTemplate, , registerTemplateHelpers */
function parseTemplate(templateId, data, divId) {
  // parse the template
  const templateElement = document.getElementById(templateId);
  const template = Template7.compile(templateElement.innerHTML);
  const html = template(data);
  const div = document.getElementById(divId);
  div.innerHTML = html;
}

function registerTemplateHelpers() {
  Template7.registerHelper('get', function(obj, key, name) {
    if (!obj[key]) {
      return 0;
    }
    return obj[key][name];
  });

  Template7.registerHelper('getAsBytes', function(obj, key, name) {
    if (!obj[key]) {
      return 0;
    }
    return formatBytes(obj[key][name]);
  });
}
