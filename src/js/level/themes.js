/* themes.js
 * Pure data: every creature, obstacle kind and per-theme/per-difficulty
 * content table.  Both the 2D canvas renderer and the 3D WebGL renderer read
 * the same tables, so a "panther" is the same monster in either view.
 * Exposes: TH.Themes = { CREATURES, OBSTACLE_NAMES, THEMES, DIFF_RULES, creature }
 */
(function(){
  // family = how it is drawn (see sprites2d.js / creatures3d.js)
  // col = [body, accent, eye];  s = size scale;  dmg = base damage;  spd = base speed (px/s)
  const C=(family,name,col,s,dmg,spd,extra)=>Object.assign({family,name,col,s,dmg,spd},extra||{});
  const CREATURES={
    // jungle
    monkey:C('quad','Monkey',['#8a5a2b','#d9b27a','#111'],0.8,20,52,{arms:true}),
    snake:C('serpent','Viper',['#4c9a2a','#e0d040','#d22'],1,25,48),
    boar:C('quad','Wild Boar',['#5a4033','#e8e0c8','#111'],1.1,25,55,{tusks:true}),
    panther:C('quad','Black Panther',['#1c1c24','#3a3a4a','#ffd23a'],1.15,35,78,{tail:true}),
    spider:C('spider','Giant Spider',['#2b2233','#7a2a8a','#f33'],1.15,35,64),
    golem:C('golem','Moss Golem',['#6a7a5a','#3d5a2c','#ffb830'],1.5,45,46,{hunter:true}),
    shaman:C('humanoid','Jungle Shaman',['#7a3a1a','#d9a030','#fff'],1.1,35,58,{mask:true}),
    // mansion
    rat:C('quad','Giant Rat',['#5a5560','#d8a0a0','#f33'],0.7,15,70,{tail:true}),
    bat:C('bat','Vampire Bat',['#3a2a44','#7a5a8a','#f33'],0.85,20,74),
    ghost:C('ghost','Ghost',['#dfe6ee','#b9c9e0','#223'],1.15,25,40,{alpha:.7}),
    skeleton:C('humanoid','Skeleton',['#e6e0cc','#bdb59a','#222'],1.1,35,56,{bones:true}),
    zombie:C('humanoid','Zombie',['#6f8a5a','#4a3a2a','#ddd'],1.15,35,42,{shamble:true}),
    wraith:C('ghost','Wraith',['#4a3a6a','#1a1030','#ff4a4a'],1.35,40,62,{hunter:true,alpha:.8}),
    demon:C('blob','Imp Demon',['#9a1a2a','#ff7a2a','#ffe83a'],1.3,45,66,{horns:true,hunter:true}),
    // pirate
    crab:C('crab','Giant Crab',['#d2552a','#f08a4a','#111'],0.95,25,52),
    gull:C('bat','Sea Gull',['#f0f0f0','#c8c8c8','#111'],0.8,15,68,{beak:true}),
    pirate:C('humanoid','Pirate',['#a02a2a','#2a2a40','#fff'],1.1,30,54,{hat:true}),
    parrot:C('bat','Rogue Parrot',['#2ab04a','#e83a3a','#111'],0.8,15,72,{beak:true}),
    ghostpirate:C('ghost','Ghost Captain',['#8fe8d8','#2a6a6a','#ff4'],1.3,40,50,{alpha:.65,hat:true}),
    kraken:C('blob','Tentacle Beast',['#4a2a7a','#9a5ad8','#ff0'],1.5,45,50,{tentacles:true}),
    brute:C('humanoid','Pirate Brute',['#5a3a2a','#202020','#fff'],1.4,45,48,{hat:true,hunter:true}),
    skelpirate:C('humanoid','Skeleton Pirate',['#e6e0cc','#6a2a2a','#222'],1.15,40,60,{bones:true,hat:true}),
    // city
    car:C('vehicle','Speeding Car',['#e8c34a','#222','#ffe'],1.2,30,78),
    van:C('vehicle','Delivery Van',['#c8d0d8','#2a4a8a','#ffe'],1.45,40,66,{long:true}),
    dog:C('quad','Guard Dog',['#7a5a3a','#d8b078','#111'],0.85,25,72,{tail:true}),
    guard:C('humanoid','Security Guard',['#2a3a6a','#c8c8d0','#ddd'],1.1,30,50,{cap:true}),
    thief:C('humanoid','Thief',['#2a2a2a','#7a1a1a','#fff'],1.05,30,66,{mask:true}),
    cdrone:C('drone','Police Drone',['#3a4a6a','#4aa8ff','#ff3a3a'],0.95,30,70),
    gangster:C('humanoid','Gangster',['#3a2a3a','#d8d0c0','#fff'],1.2,40,58,{hat:true,hunter:true}),
    mutant:C('blob','Sewer Mutant',['#5ab03a','#2a6a1a','#ffe83a'],1.35,45,54,{hunter:true}),
    // space station
    sdrone:C('drone','Patrol Drone',['#6bd0e0','#2a5a7a','#ff4a4a'],1,25,70),
    sentry:C('golem','Sentry Bot',['#9aa4b4','#e06b6b','#ff3a3a'],1.2,30,48,{robot:true}),
    slime:C('blob','Acid Slime',['#7ae04a','#3a8a1a','#ff0'],1.05,25,44),
    alien:C('humanoid','Grey Alien',['#8aa890','#2a3a30','#000'],1.05,35,62,{bigeyes:true}),
    crawler:C('spider','Xeno Crawler',['#3a2a50','#a04ad8','#f3a'],1.25,40,72),
    xeno:C('quad','Xenomorph',['#1a1a26','#4a4a5a','#9f3'],1.3,45,80,{tail:true,hunter:true}),
    brutebot:C('golem','War Mech',['#4a5a7a','#e0a02a','#f33'],1.7,50,46,{robot:true,hunter:true}),
    // mirror world
    wisp:C('ghost','Mirror Wisp',['#9fd8ff','#e0f4ff','#134'],0.95,20,44,{alpha:.6,glow:true}),
    shardling:C('blob','Shardling',['#7ad0f0','#e8faff','#134'],1,25,52,{crystal:true}),
    shade:C('ghost','Shade',['#3a2a6a','#8a5ad8','#fff'],1.2,35,58,{alpha:.7}),
    crystalspider:C('spider','Crystal Spider',['#8ad8ff','#d8f4ff','#f4a'],1.2,40,66,{crystal:true}),
    knight:C('humanoid','Mirror Knight',['#c8d8e8','#4a6a9a','#4af'],1.3,45,54,{helm:true,hunter:true}),
    glassgolem:C('golem','Glass Golem',['#a8e0f8','#5aa8d8','#fff'],1.6,50,46,{crystal:true,hunter:true})
  };

  // obstacle kinds -> display names (visual builders live in sprites2d.js / scene3d.js)
  const OBSTACLE_NAMES={
    tree:'Jungle Tree',bush:'Thorn Bush',boulder:'Boulder',ruin:'Ruined Pillar',totem:'Totem',
    shelf:'Bookshelf',table:'Dining Table',statue:'Statue',coffin:'Coffin',candles:'Candelabra',
    palm:'Palm Tree',crate:'Cargo Crate',barrel:'Barrel',cannon:'Cannon',rock:'Sea Rock',
    parked:'Parked Car',barrier:'Barrier',dumpster:'Dumpster',lamp:'Street Lamp',bench:'Bench',
    cargo:'Cargo Pod',reactor:'Reactor Core',console:'Console',pipe:'Pipe Stack',tank:'Fuel Tank',
    crystal:'Crystal',shard:'Mirror Shard',orb:'Glass Orb',monolith:'Monolith',spire:'Spire'
  };

  /* Per theme: obstacle kinds and monster kinds available at each difficulty.
   * Easy / medium / hard deliberately use DIFFERENT sets so every level feels new. */
  const THEMES={
    jungle:{
      hazard:'thorns', wall:'ruinwall',
      obst:{easy:['bush','boulder','tree'], medium:['tree','boulder','ruin','bush'], hard:['tree','ruin','totem','boulder']},
      mons:{easy:['monkey','snake','boar'], medium:['boar','snake','panther','spider'], hard:['panther','spider','golem','shaman','snake']}
    },
    mansion:{
      hazard:'spikes', wall:'wallpaper',
      obst:{easy:['table','candles','shelf'], medium:['shelf','statue','table','candles'], hard:['coffin','statue','shelf','candles']},
      mons:{easy:['ghost','rat','bat'], medium:['ghost','bat','skeleton','zombie'], hard:['wraith','skeleton','zombie','demon','bat']}
    },
    pirate:{
      hazard:'firepit', wall:'cliff',
      obst:{easy:['palm','crate','barrel'], medium:['crate','barrel','cannon','palm'], hard:['cannon','rock','crate','barrel']},
      mons:{easy:['crab','gull','pirate'], medium:['crab','pirate','parrot','skelpirate'], hard:['ghostpirate','kraken','brute','skelpirate','crab']}
    },
    city:{
      hazard:'wires', wall:'building',
      obst:{easy:['bench','lamp','barrier'], medium:['parked','barrier','dumpster','lamp'], hard:['parked','dumpster','barrier','lamp']},
      mons:{easy:['car','dog','guard'], medium:['car','dog','thief','cdrone'], hard:['van','gangster','cdrone','mutant','dog']}
    },
    spacestation:{
      hazard:'laser', wall:'hull',
      obst:{easy:['cargo','console','pipe'], medium:['cargo','tank','console','pipe'], hard:['reactor','tank','cargo','console']},
      mons:{easy:['sdrone','sentry','slime'], medium:['sdrone','alien','slime','crawler'], hard:['crawler','xeno','brutebot','alien','sdrone']}
    },
    mirror:{
      hazard:'shards', wall:'crystalwall',
      obst:{easy:['orb','crystal','shard'], medium:['crystal','shard','monolith','orb'], hard:['spire','monolith','shard','crystal']},
      mons:{easy:['wisp','shardling'], medium:['wisp','shade','crystalspider','shardling'], hard:['shade','crystalspider','knight','glassgolem','wisp']}
    }
  };

  // Level scale & rules per difficulty
  const DIFF_RULES={
    easy:  {w:32,h:22,clusterK:.050,cluster:4,hazards:6, coins:12,checks:2,monsters:4, hunters:0,speed:.85,dmg:.8, label:'Easy'},
    medium:{w:40,h:26,clusterK:.062,cluster:5,hazards:14,coins:16,checks:3,monsters:7, hunters:2,speed:1.0,dmg:1.0,label:'Medium'},
    hard:  {w:48,h:30,clusterK:.072,cluster:6,hazards:24,coins:20,checks:3,monsters:11,hunters:4,speed:1.2,dmg:1.2,label:'Hard'}
  };

  function creature(kind){ return CREATURES[kind]||CREATURES.ghost; }

  window.TH=window.TH||{};
  TH.Themes={CREATURES,OBSTACLE_NAMES,THEMES,DIFF_RULES,creature};
})();
