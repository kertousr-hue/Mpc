(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCRaiFactory=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  var GROUPS=[
    {family:'rai-kick',category:'Batterie Raï',names:Array.from({length:16},function(_,i){return 'Kick Raï '+String(i+1).padStart(2,'0')})},
    {family:'rai-snare-rim',category:'Snares & Rims Raï',names:[
      'Snare Raï 01','Snare Raï 02','Snare Raï 03','Snare Raï 04','Snare Raï 05','Snare Raï 06','Snare Raï 07','Snare Raï 08',
      'Rim Raï 01','Rim Raï 02','Rim Raï 03','Rim Raï 04','Rim Raï 05','Rim Raï 06','Rim Raï 07','Rim Raï 08'
    ]},
    {family:'rai-clap',category:'Claps Raï',names:Array.from({length:8},function(_,i){return 'Clap Raï '+String(i+1).padStart(2,'0')})},
    {family:'rai-shaker',category:'Shakers Raï',names:[
      'Shaker Raï 01','Shaker Raï 02','Shaker Raï 03','Shaker Raï 04','Shaker Raï 05','Shaker Raï 06','Shaker Raï 07','Shaker Raï 08',
      'Shaker Raï 09','Shaker Raï 10','Shaker Raï 11','Shaker Raï 12','Hi-Hat Raï 01','Hi-Hat Raï 02','Hi-Hat Raï 03','Hi-Hat Raï 04'
    ]},
    {family:'rai-riq-open',category:'Riq & Open Shakers Raï',names:[
      'Riq Raï 01','Riq Raï 02','Riq Raï 03','Riq Raï 04',
      'Open Shaker Raï 01','Open Shaker Raï 02','Open Shaker Raï 03','Open Shaker Raï 04'
    ]},
    {family:'rai-darbuka-guellal',category:'Darbuka & Guellal Raï',names:[
      'Darbuka Doum 01','Darbuka Doum 02','Darbuka Doum 03','Darbuka Doum 04',
      'Darbuka Tek 01','Darbuka Tek 02','Darbuka Tek 03','Darbuka Tek 04',
      'Guellal Doum 01','Guellal Doum 02','Guellal Doum 03','Guellal Doum 04',
      'Guellal Tek 01','Guellal Tek 02','Guellal Tek 03','Guellal Tek 04'
    ]},
    {family:'rai-bendir-tbal',category:'Bendir & Tbal Raï',names:[
      'Bendir Raï 01','Bendir Raï 02','Bendir Raï 03','Bendir Raï 04',
      'Tbal Raï 01','Tbal Raï 02','Tbal Raï 03','Tbal Raï 04'
    ]},
    {family:'rai-cymbal-tambour',category:'Cymbals & Tambourins Raï',names:[
      'Cymbal Raï 01','Cymbal Raï 02','Cymbal Raï 03','Cymbal Raï 04',
      'Tambourin Raï 01','Tambourin Raï 02','Tambourin Raï 03','Tambourin Raï 04'
    ]},
    {family:'rai-bass',category:'Bass Raï',names:[
      'Bass Raï Ronde 01','Bass Raï Ronde 02','Bass Raï Ronde 03','Bass Raï Ronde 04',
      'Bass Raï Synth 01','Bass Raï Synth 02','Bass Raï Synth 03','Bass Raï Synth 04',
      'Bass Raï Glide 01','Bass Raï Glide 02','Bass Raï Punch 01','Bass Raï Punch 02'
    ]},
    {family:'rai-melodic',category:'Mélodies Raï',names:[
      'Gasba Raï 01','Gasba Raï 02','Accordéon Raï 01','Accordéon Raï 02',
      'Trumpette Raï 01','Trumpette Raï 02','Guitare Raï 01','Guitare Raï 02',
      'Synth Lead Raï 01','Synth Lead Raï 02','Strings Raï 01','Stab Raï 01'
    ]},
    {family:'rai-vox-fx',category:'Vox & FX Raï',names:[
      'Vox Raï 01','Vox Raï 02','Vox Raï 03','Vox Raï 04',
      'FX Raï Rise 01','FX Raï Fall 01','FX Raï Hit 01','FX Raï Texture 01'
    ]}
  ];

  var FACTORY_SPEC=GROUPS.map(function(g){return [g.category,g.family,g.names.length]});

  function buildFactory(){
    var out=[],index=0;
    GROUPS.forEach(function(group){
      group.names.forEach(function(name,localIndex){
        out.push({
          id:'factory-'+(index+1),
          factoryIndex:index,
          name:name,
          category:group.category,
          family:group.family,
          variant:localIndex+1
        });
        index++;
      });
    });
    return out;
  }

  var DEFAULT_RAI_BANK=[0,16,40,64,32,24,72,80,96,108,110,56,112,114,116,120];

  var RAI_KITS=[
    {name:'KIT RAÏ DRUMS',offset:0,description:'Kick · Snare · Rim · Clap'},
    {name:'KIT RAÏ SHAKERS',offset:32,description:'Clap · Shaker · Riq · Open'},
    {name:'KIT RAÏ PERCUS',offset:64,description:'Darbuka · Guellal · Bendir · Tbal'},
    {name:'KIT RAÏ BASS',offset:96,description:'Bass raï · Gasba · Accordéon'},
    {name:'KIT RAÏ LEADS & VOX',offset:112,description:'Trumpette · Guitare · Synth · Vox'}
  ];

  function createRaiBeat(){
    return {
      0:[0,4,8,12],
      1:[4,12],
      2:[0,2,4,6,8,10,12,14],
      3:[2,5,7,10,13,15],
      4:[4,12],
      5:[3,11],
      6:[0,8],
      7:[6,14]
    };
  }

  return {
    GROUPS:GROUPS,
    FACTORY_SPEC:FACTORY_SPEC,
    DEFAULT_RAI_BANK:DEFAULT_RAI_BANK,
    RAI_KITS:RAI_KITS,
    buildFactory:buildFactory,
    createRaiBeat:createRaiBeat
  };
});
