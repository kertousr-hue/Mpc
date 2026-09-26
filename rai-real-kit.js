(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCRealRaiKit=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  var SOURCES=[
    {
      id:'darbuka',
      instrument:'Darbuka',
      count:4,
      maxDur:.85,
      url:'https://upload.wikimedia.org/wikipedia/commons/e/ed/Darbuka.ogg',
      source:'https://commons.wikimedia.org/wiki/File:Darbuka.ogg',
      creator:'Cassa342',
      license:'CC BY-SA 4.0',
      provider:'Wikimedia Commons',
      realRecording:true
    },
    {
      id:'riq',
      instrument:'Riq',
      count:2,
      maxDur:.65,
      url:'https://upload.wikimedia.org/wikipedia/commons/d/db/Riq_demo.ogg',
      source:'https://commons.wikimedia.org/wiki/File:Riq_demo.ogg',
      creator:'Derbake',
      license:'CC BY-SA 4.0',
      provider:'Wikimedia Commons',
      realRecording:true
    },
    {
      id:'bendir',
      instrument:'Bendir',
      count:2,
      maxDur:.95,
      url:'https://upload.wikimedia.org/wikipedia/commons/e/e4/T%C3%BCrk_Aksa%C4%9F%C4%B1_%2890_bpm%29.ogg',
      source:'https://commons.wikimedia.org/wiki/File:T%C3%BCrk_Aksa%C4%9F%C4%B1_(90_bpm).ogg',
      creator:'Anomyq',
      license:'CC0 1.0',
      provider:'Wikimedia Commons',
      realRecording:true
    },
    {
      id:'accordion',
      instrument:'Accordéon',
      count:3,
      maxDur:1.6,
      url:'https://upload.wikimedia.org/wikipedia/commons/9/91/Accordion_registers.ogg',
      source:'https://commons.wikimedia.org/wiki/File:Accordion_registers.ogg',
      creator:'Necz0r',
      license:'Public Domain',
      provider:'Wikimedia Commons',
      realRecording:true
    },
    {
      id:'trumpet-f4',
      instrument:'Trompette',
      count:1,
      maxDur:2.4,
      url:'https://upload.wikimedia.org/wikipedia/commons/8/88/03._F4-trumpet.ogg',
      source:'https://commons.wikimedia.org/wiki/File:03._F4-trumpet.ogg',
      creator:'ПростоУчастник',
      license:'CC0 1.0',
      provider:'Wikimedia Commons',
      realRecording:true
    },
    {
      id:'trumpet-d5',
      instrument:'Trompette',
      count:1,
      maxDur:2.4,
      url:'https://upload.wikimedia.org/wikipedia/commons/a/a7/05._D5-trumpet.ogg',
      source:'https://commons.wikimedia.org/wiki/File:05._D5-trumpet.ogg',
      creator:'ПростоУчастник',
      license:'CC0 1.0',
      provider:'Wikimedia Commons',
      realRecording:true
    },
    {
      id:'guitar',
      instrument:'Guitare',
      count:3,
      maxDur:2,
      url:'https://upload.wikimedia.org/wikipedia/commons/b/b6/Wikipedia_guitar_solo.ogg',
      source:'https://commons.wikimedia.org/wiki/File:Wikipedia_guitar_solo.ogg',
      creator:'Leechfoot',
      license:'CC0 1.0',
      provider:'Wikimedia Commons',
      realRecording:true
    }
  ];

  var OPEN_LAYOUT=[
    {sourceId:'darbuka',take:0,instrument:'Darbuka',name:'Darbuka 01'},
    {sourceId:'darbuka',take:1,instrument:'Darbuka',name:'Darbuka 02'},
    {sourceId:'darbuka',take:2,instrument:'Darbuka',name:'Darbuka 03'},
    {sourceId:'darbuka',take:3,instrument:'Darbuka',name:'Darbuka 04'},
    {sourceId:'riq',take:0,instrument:'Riq',name:'Riq 01'},
    {sourceId:'riq',take:1,instrument:'Riq',name:'Riq 02'},
    {sourceId:'bendir',take:0,instrument:'Bendir',name:'Bendir 01'},
    {sourceId:'bendir',take:1,instrument:'Bendir',name:'Bendir 02'},
    {sourceId:'accordion',take:0,instrument:'Accordéon',name:'Accordéon 01'},
    {sourceId:'accordion',take:1,instrument:'Accordéon',name:'Accordéon 02'},
    {sourceId:'accordion',take:2,instrument:'Accordéon',name:'Accordéon 03'},
    {sourceId:'trumpet-f4',take:0,instrument:'Trompette',name:'Trompette F4'},
    {sourceId:'trumpet-d5',take:0,instrument:'Trompette',name:'Trompette D5'},
    {sourceId:'guitar',take:0,instrument:'Guitare',name:'Guitare 01'},
    {sourceId:'guitar',take:1,instrument:'Guitare',name:'Guitare 02'},
    {sourceId:'guitar',take:2,instrument:'Guitare',name:'Guitare 03'}
  ];

  var LICENSED_GAPS=[
    {
      instrument:'Gasba',
      reason:'Aucune source gratuite isolée avec licence de redistribution suffisamment sûre trouvée.',
      nextStep:'commercial-source-to-validate'
    },
    {
      instrument:'Guellal',
      reason:'Aucune source gratuite isolée avec licence de redistribution suffisamment sûre trouvée.',
      nextStep:'commercial-source-to-validate'
    }
  ];

  return {
    SOURCES:SOURCES,
    OPEN_LAYOUT:OPEN_LAYOUT,
    LICENSED_GAPS:LICENSED_GAPS
  };
});
