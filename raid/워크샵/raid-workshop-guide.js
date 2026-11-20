'use strict';
function context(s){const job=s.pending?.action==='job'?s.pending.value:s.account.job;return {config:{job,level:s.level},workshop:{equipped:job===s.account.job?s.account.equipped:{}}};}
function page(s){return require('../클래스/raid-skill-guide.js').resolvePage(context(s),s.guidePage||'core');}
function pages(s){return require('../클래스/raid-skill-guide.js').pages(context(s));}
module.exports={assets:s=>require('../클래스/raid-skill-guide.js').assets(context(s),page(s)),page,pages,components:s=>require('../클래스/raid-skill-guide.js').components(context(s),page(s))};
