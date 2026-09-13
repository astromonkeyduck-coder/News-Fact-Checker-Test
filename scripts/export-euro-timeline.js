// Keep the downloadable reference table in sync with the classroom timeline.
const fs = require('node:fs');
const path = require('node:path');
const euro = path.resolve(__dirname, '../euro');
const data = JSON.parse(fs.readFileSync(path.join(euro, 'timeline_data.json'), 'utf8'));
const columns = ['id','date','startYear','endYear','precision','title','type','apUnit','apTopic','region','category','apTheme','tier','description','whyItMatters','causes','effects','memoryHook','sourceNote','confidence','sourceUrls'];
const cell = value => {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};
fs.writeFileSync(path.join(euro, 'timeline_data.csv'), [columns.join(','), ...data.map(record => columns.map(key => cell(record[key])).join(','))].join('\n')+'\n');
console.log(`Exported ${data.length} AP European History events.`);
