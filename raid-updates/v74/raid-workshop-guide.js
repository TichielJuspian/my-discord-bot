'use strict';
function assets(s){const job=s.pending?.action==='job'?s.pending.value:s.account.job;return require('./raid-skill-guide').assets({config:{job,level:s.level},workshop:{equipped:job===s.account.job?s.account.equipped:{}}},s.guidePage||'core');}
module.exports={assets};
