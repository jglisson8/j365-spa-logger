const journeys=require('./fixtures/forecast-journeys.cjs'),{replay}=require('./qa/replay.cjs');
for(const journey of journeys){replay(journey);console.log('PASS release contract: '+journey.id+' · FC/pH/TA · Home/Trends/model · immutable events');}
