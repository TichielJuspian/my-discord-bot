const {EmbedBuilder,AttachmentBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,StringSelectMenuBuilder}=require('discord.js');
const {CATALOG}=require('./points-store');
const {SLOTS,SLOT_NAMES}=require('./profile-accessories');
const {animatedHero}=require('./atelier-art');
const {renderShelfAsync}=require('./community-cards');
const {createGalleryCache,rendererNamespace}=require('./shop-media-cache');
const path=require('node:path');
const {SETS,ownsItem}=require('./profile-sets');
const {collectionProgress}=require('./collector');
const SHOP_TABS=['regular','anime','set','badge'];
const LABELS={...SLOT_NAMES,regular:'Backgrounds',anime:'Anime',set:'Sets',badge:'Badges'};
const SERIES=[...new Set(CATALOG.filter(i=>i.saleCategory==='anime').map(i=>i.series))];
const PAGE_SIZE=6;
let banner;
function shopBanner() {
  if(banner)return banner;
  try {
    const bytes=require('node:fs').readFileSync(path.join(__dirname,'profile-atelier-banner.gif'));
    if(bytes.length>100&&['GIF89a','GIF87a'].includes(bytes.subarray(0,6).toString()))return banner=bytes;
  } catch { /* Preserve availability if the bundled banner is missing. */ }
  console.warn('[SHOP] Bundled banner unavailable; generating a fallback.');
  return banner=animatedHero();
}
let gallery;
const cachedShelf=items=>(gallery||=(createGalleryCache({directory:path.join(__dirname,'.shop-cache'),namespace:rendererNamespace(__dirname),render:renderShelfAsync}))).get(items);
const row=(...c)=>new ActionRowBuilder().addComponents(...c);
const btn=(id,label,primary=false,disabled=false)=>new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(primary?ButtonStyle.Primary:ButtonStyle.Secondary).setDisabled(disabled);
function shopHome() {
  return {content:'',attachments:[],embeds:[new EmbedBuilder().setColor(0xc5a46e).setTitle('PROFILE ATELIER')
    .setDescription('Find a look you love. Browse the pictures, try it on your own card, then choose.\n\n**Backgrounds · 3,000 points**\n**Anime backgrounds · 6,000 points**\n**Classic sets · 9,000 points**\n**Mythic sets · 12,000 points**\n**Premium sets · 14,000 points**\n\nSets include the matching background, frame and glow. Frames and glows are available through sets only. Badges are separate.')
    .setImage('attachment://profile-atelier.gif')
    .setFooter({text:'6 picture previews per page · Filter anime by series and sets by price · All browsing and purchases are private'})],
    files:[new AttachmentBuilder(shopBanner(),{name:'profile-atelier.gif'})],components:[row(...SHOP_TABS.map(s=>btn(`points:open_${s}`,LABELS[s],s==='regular'))),row(btn('points:skin:home','Buy MLBB SKIN',true),btn('points:balance','My points'),btn('points:wardrobe','My collection'))],allowedMentions:{parse:[]}};
}
function categoryItems(type,ownedOnly,w,filter='all') {
  let all=[...SETS,...CATALOG].filter(item=>ownedOnly?item.type===type&&ownsItem(w,item):item.saleable!==false&&(type==='set'?item.type==='set':type==='badge'?item.type==='badge':item.saleCategory===type));
  if(!ownedOnly&&type==='anime'&&filter!=='all')all=all.filter(i=>i.series===SERIES[Number(filter)]);
  if(!ownedOnly&&type==='set'&&filter!=='all')all=all.filter(i=>filter==='originalanime'?i.originalAnime:filter==='mlbb'?i.mlbb:i.saleCategory===filter);
  return all;
}
async function shop(store,i,type='regular',page=0,ownedOnly=false,filter='all') {
  const tabs=ownedOnly?['set',...SLOTS]:SHOP_TABS;
  if(!tabs.includes(type))type=type==='Badges'?'badge':ownedOnly?'theme':'regular';
  const w=await store.wallet(i.guildId,i.user.id),all=categoryItems(type,ownedOnly,w,filter);
  const max=Math.max(0,Math.ceil(all.length/PAGE_SIZE)-1);page=Math.max(0,Math.min(max,Number(page)||0));
  const items=all.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE),uid=i.user.id;
  let image;
  if(items.length)image=await cachedShelf(items);
  const title=ownedOnly?'MY COLLECTION':type==='set'?'COMPLETE SETS':type==='anime'?'ANIME BACKGROUNDS':LABELS[type].toUpperCase();
  const info=ownedOnly?'Owned pieces stay yours. Equip and mix them for free.':type==='set'?'Background + frame + glow, together. Browse Classic, Mythic, original anime and MLBB sets below. No individual frame or glow purchases.':type==='anime'?'40 character backgrounds without the added ornamental frame. Jump straight to your favorite series below.':'Choose a picture below to try it on your real profile. Nothing is spent until you confirm.';
  const embed=new EmbedBuilder().setColor(0xc5a46e).setTitle(title).setDescription(`**${w.balance.toLocaleString()} points** · Page **${page+1} / ${max+1}** · ${all.length} looks\n${ownedOnly ? collectionProgress(w)+'\n\n' : ''}${info}`)
    .setFooter({text:items.length?'Pictures use sample profile values · Choose the matching number to see your own card':'Try another category or visit the shop to start your collection.'});
  if(image)embed.setImage('attachment://atelier-shelf.png');
  const components=[row(...tabs.map(s=>btn(`points:${ownedOnly?'ownedtab':'tab'}:${uid}:${s}`,LABELS[s],s===type)))];
  if(!ownedOnly&&['anime','set'].includes(type))components.push(row(new StringSelectMenuBuilder().setCustomId(`points:filter:${uid}:${type}`).setPlaceholder(type==='anime'?'Jump to an anime series…':'Jump to a set collection…').addOptions(type==='anime'?[{label:'All anime',value:'all',default:filter==='all'},...SERIES.map((s,n)=>({label:s,value:String(n),default:filter===String(n)}))]:[['all','All sets'],['classic','Classic · 9,000'],['mythic','Mythic · 12,000'],['originalanime','Original anime · 14,000'],['mlbb','MLBB · 14,000']].map(([value,label])=>({label,value,default:filter===value})))));
  if(items.length)components.push(row(new StringSelectMenuBuilder().setCustomId(`points:preview:${uid}:${type}:${page}:${filter}:${ownedOnly?'owned':'shop'}`).setPlaceholder('Pick a picture number to try on…').addOptions(items.map((item,n)=>({label:`${n+1} · ${item.name}`.slice(0,100),value:item.id,description:`${item.price.toLocaleString()} points${ownsItem(w,item)?' / Owned':''}`})))));
  components.push(row(btn(`points:${ownedOnly?'ownedpage':'page'}:${uid}:${type}:${Math.max(0,page-1)}:${filter}:prev`,'Previous',false,page===0),btn(`points:${ownedOnly?'ownedpage':'page'}:${uid}:${type}:${Math.min(max,page+1)}:${filter}:next`,'Next',false,page===max),btn('points:home','Back'),btn('points:wardrobe','My collection'),btn('points:skin:home','Buy MLBB SKIN',true)));
  if(max>0)components.push(row(new StringSelectMenuBuilder().setCustomId(`points:jump:${uid}:${type}:${filter}:${ownedOnly?'owned':'shop'}`).setPlaceholder('Jump straight to a page…').addOptions(Array.from({length:max+1},(_,n)=>({label:`Page ${n+1}`,value:String(n),description:all.slice(n*PAGE_SIZE,n*PAGE_SIZE+3).map(i=>i.name.split(' / ')[0]).join(' · ').slice(0,100),default:n===page})))));
  if(ownedOnly&&type!=='set')components.push(row(btn(`points:reset:${uid}:${type}`,`Remove ${type==='theme'?'background':type}`)));
  return {content:'',attachments:[],embeds:[embed],files:image?[new AttachmentBuilder(image,{name:'atelier-shelf.png'})]:[],components,allowedMentions:{parse:[]}};
}
async function warmPopularPages() {
  for(const type of SHOP_TABS){const items=categoryItems(type,false,{owned:[]}).slice(0,PAGE_SIZE);if(items.length)await cachedShelf(items);await new Promise(resolve=>setTimeout(resolve,75));}
  console.log('[SHOP] Popular galleries ready; persistent cache and avatar reuse enabled.');
}
module.exports={shopHome,shop,categoryItems,SHOP_TABS,SERIES,PAGE_SIZE,warmPopularPages};

