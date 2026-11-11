const {CHARACTERS,RENDER_CHARACTERS,themeId,pieces}=require('./character-sets');
const SET_PRICE=12000, FRAME_PRICE=12000;
function characterTheme(c) {
  return {id:themeId(c),type:'theme',name:`${c.name} / ${c.cardName}`,cardName:c.cardName,price:4000,color:parseInt(c.primary.slice(1),16),rarity:'Mythic',art:`character_${c.key}`,hero:c.key,backdrop:c.backdrop,characterRenewal:true,series:c.series,saleCategory:c.atlas?'anime':undefined};
}
const NEW_PIECES=CHARACTERS.flatMap(c=>[
  characterTheme(c),
  {id:pieces(c).frame,type:'frame',name:`${c.name} / Frame`,price:FRAME_PRICE,color:parseInt(c.primary.slice(1),16),rarity:'Mythic',characterRenewal:true,character:c.key},
  {id:pieces(c).glow,type:'glow',name:`${c.name} / Glow`,price:2500,color:parseInt(c.primary.slice(1),16),rarity:'Mythic',characterRenewal:true,character:c.key},
]);
const ORIGINAL_SETS=[
  ['silverline','Silverline','arctic','mist'],['jade','Jade Filigree','bamboo','jade'],['sakura','Sakura Porcelain','sakura','rose'],['tide','Tidal Crest','ocean','tide'],
  ['frost','Frost Cathedral','frost_paladin','mist'],['eclipse','Eclipse Halo','eclipse','astral'],['obsidian','Obsidian Sovereign','obsidian_shogun','ember'],['phoenix','Phoenix Ascendant','phoenix','ember'],
  ['seraph','Astral Seraph','astral_seraph','astral'],['dragon','Cosmic Dragon','cosmic_dragon','astral'],['genesis','Genesis Crown','genesis','genesis'],['dawn','Eternal Dawn','eternal_dawn','dawn'],
];
// Legacy frame sets retain illustrated prestige foundations, rather than inheriting a renewed character accidentally.
const SAFE_FOUNDATIONS={silverline:'theme_frost_paladin',jade:'theme_dragon',sakura:'theme_crystal_lotus',tide:'theme_tidal_empress'};
const LEGACY_SETS=Object.freeze(CHARACTERS.map(c=>Object.freeze({id:`set_hero_${c.key}`,type:'set',name:`${c.name} / Archived Set`,price:SET_PRICE,rarity:'Mythic',color:parseInt(c.primary.slice(1),16),character:c.key,pieces:pieces(c),saleable:false})));
const SETS=Object.freeze([
  ...ORIGINAL_SETS.map(([id,name,theme,glow],index)=>({id:`set_${id}`,type:'set',name:`${name} / Complete Set`,price:index>=8?10000:7000,rarity:index>=8?'Mythic':'Classic',saleCategory:index>=8?'mythic':'classic',color:0xd6ba83,pieces:{theme:SAFE_FOUNDATIONS[id]||`theme_${theme}`,frame:`frame_${id}`,glow:`glow_${glow}`}})),
  ...RENDER_CHARACTERS.filter(c=>!c.atlas).map(c=>({id:`set_hero_${c.key}`,type:'set',name:`${c.name} / Complete Set`,price:SET_PRICE,rarity:'Premium',saleCategory:'premium',mlbb:true,color:parseInt(c.primary.slice(1),16),pieces:pieces(c)})),
  ...CHARACTERS.filter(c=>c.legacy).map(c=>({id:`set_hero_${c.key}`,type:'set',name:`${c.name} / Original Anime Set`,price:SET_PRICE,rarity:'Premium',saleCategory:'premium',originalAnime:true,color:parseInt(c.primary.slice(1),16),series:c.series,pieces:{...pieces(c),frame:`frame_animeclassic_${c.key}`}})),
].map(s=>Object.freeze({...s,price:s.price+2000,pieces:Object.freeze(s.pieces)})));
const ORIGINAL_PIECES=RENDER_CHARACTERS.filter(c=>!c.atlas).flatMap(c=>[characterTheme(c),{id:pieces(c).frame,type:'frame',name:`${c.name} / Frame`,price:SET_PRICE,color:parseInt(c.primary.slice(1),16),rarity:'Premium',characterRenewal:true,character:c.key},{id:pieces(c).glow,type:'glow',name:`${c.name} / Glow`,price:SET_PRICE,color:parseInt(c.primary.slice(1),16),rarity:'Premium',characterRenewal:true,character:c.key}]);
ORIGINAL_PIECES.push(...CHARACTERS.filter(c=>c.legacy).map(c=>({id:`frame_animeclassic_${c.key}`,type:'frame',name:`${c.name} / Original Frame`,price:SET_PRICE,color:parseInt(c.primary.slice(1),16),rarity:'Premium',characterRenewal:true,character:c.key})));
function ownsItem(wallet,item) { return item.type==='set'?Object.values(item.pieces).every(id=>wallet.owned?.includes(id)):wallet.owned?.includes(item.id)||false; }
function previewOutfit(wallet,item) { return item.type==='set'?{...wallet,...item.pieces}:item.saleCategory==='anime'?{...wallet,theme:item.id,frame:null,glow:null}:{...wallet,[item.type]:item.id}; }
module.exports={SET_PRICE,FRAME_PRICE,NEW_PIECES:[...NEW_PIECES,...ORIGINAL_PIECES],SETS,LEGACY_SETS,characterTheme,ownsItem,previewOutfit};
