//=============================================================================
// MonlineEncyclopedia.js
//=============================================================================
/*:
 * @plugindesc Faithful port of Nova::Encyclopedia 2.1 (0146.rb): the PXEpedia scene.
 * @author Monline port
 *
 * @help
 * 0146.rb is the "PXEpedia" - the in-game manual the PXE menu opens with
 * `SceneManager.call(Encyclopedia)`.  It is content driven: five categories
 * (Story Summary / Places / People / States / Tips) and 74 topics, each one
 * unlocked by a story switch and rendered as a topic picture plus a long
 * paragraph.
 *
 * What is reproduced
 *   * the config blocks verbatim (Help / Category_Main / Topics_Main /
 *     Info_Main / Background / Particles) - all the "use an image instead of
 *     a window" switches are off in this game, so the windowskin path is the
 *     one that runs;
 *   * the 5 Categories and all 74 Topics with their switch ids, icons, topic
 *     pictures and info text, extracted from the Ruby source in file order;
 *   * Pedia_Category, Pedia_Topics, Pedia_Help, Pedia_Information and
 *     Pedia_Particles, laid out with the Ruby's own proportions;
 *   * the scene's two-mode flow: category list -> OK -> topic list -> B back
 *     -> B again leaves, with the info pane tracking the highlighted topic.
 *
 * Two deliberate deviations
 *   * The Ruby's Topics hash declares "The Mythic Zone" twice, and in Ruby the
 *     second key silently overwrites the first - the first chapter would never
 *     have been reachable.  The port keeps both, in file order.
 *   * Ruby's `Bitmap.new('Graphics/Encyclopedia/...')` is synchronous;
 *     `ImageManager.loadBitmap` is not.  The topic picture therefore fades in
 *     when its bitmap finishes loading rather than appearing on the same frame.
 */
//=============================================================================

var MonlineEncyclopedia = MonlineEncyclopedia || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // Config - verbatim from 0146.rb
    //-------------------------------------------------------------------------
    var Help = {
        category_vocab: 'Select a Category.',
        topics_vocab: 'Select a Topic',
        windowskin: 'Window',
        image: false,
        folder: 'Graphics/Encyclopedia/',
        name: 'Background',
        img_ox: 0,
        img_oy: 0
    };
    var Command_in_Menu = { enable: false, switch: 1, name: 'PXEpedia' };
    var Category_Main = {
        windowskin: 'Window', image: false,
        folder: 'Graphics/Encyclopedia/', name: 'Command Box',
        img_ox: 0, img_oy: 0
    };
    var Topics_Main = {
        windowskin: 'Window', image: false,
        folder: 'Graphics/Encyclopedia/', name: 'Command Box',
        img_ox: 0, img_oy: 0
    };
    var Info_Main = {
        font_name: 'Lato', font_size: 14, font_outline: false,
        font_color: [255, 255, 255, 255],
        windowskin: 'Window', image: false,
        folder: 'Graphics/Encyclopedia/', name: 'Info Box',
        img_ox: 0, img_oy: 0
    };
    var Background = {
        enable: false, folder: 'Graphics/Encyclopedia/',
        name: 'Background', scale_to_fit: true
    };
    var Particles = {
        enable: false,
        folder: 'Graphics/Weather/',
        name: ['Light_01A', 'Light_02A'],
        amount: 60,
        animation: {
            up: true, right: true, left: false, down: false,
            speed1_min: 1, speed1_max: 4, speed2_min: 1, speed2_max: 2
        }
    };

    // 0146.rb:251 - key order is the display order
    // 0146.rb:251 - key order is the display order.  Every category carries
    // `:image? => false`, so the category sprite is always the blank 1x1 the
    // Ruby builds at 0146.rb:1331; only the icon is drawn.
    var Categories = [
        { name: 'Story Summary', symbol: 'story',  switch: 0, imageShown: false, icon: 8867 },
        { name: 'Places',        symbol: 'places', switch: 0, imageShown: false, icon: 8866 },
        { name: 'People',        symbol: 'people', switch: 0, imageShown: false, icon: 8865 },
        { name: 'States',        symbol: 'states', switch: 0, imageShown: false, icon: 8868 },
        { name: 'Tips',          symbol: 'tips',   switch: 0, imageShown: false, icon: 8869 }
    ];

    //-------------------------------------------------------------------------
    // Screen scale: the Ruby's pixel constants were tuned for 544x416.
    //-------------------------------------------------------------------------
    function scale() { return Graphics.boxWidth / 544; }

    /** 'Graphics/Encyclopedia/Topics/Places/X' -> ImageManager bitmap */
    function topicBitmap(entry) {
        var sub = String(entry.folder).replace(/^Graphics\/Encyclopedia\//, '');
        return ImageManager.loadBitmap('img/encyclopedia/' + sub, entry.image);
    }

    // 0146.rb:1331 / 1351 - when the entry says `:image? => false` the Ruby
    // assigns a 1x1 placeholder instead of loading anything.  The 23 "States"
    // topics are all like that: they show their icon, not a picture.
    function topicSprite(entry) {
        return entry.imageShown === true ? topicBitmap(entry) : new Bitmap(1, 1);
    }

    //-------------------------------------------------------------------------
    // 0146.rb:305 - the 74 topics, in file order
    //-------------------------------------------------------------------------
    var TOPICS = [
        { name: "The Forest Zone", category: "story", switch: 1441, imageShown: true, info: "It was supposed to just be a fun adventure in a new VR MMO, \\nyou were excited to join the beta test just like everyone else. \\nThen this madman in a hood shows up and traps everyone here \\nto be victims in their game. You weren't alone though. You met a guy \\nnamed Mark, and after saving each other you decided to \\ntravel together, joined by your AI companion 'PXE'.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Breachwoods", icon: 8867 },
        { name: "The Coastal Zone", category: "story", switch: 1442, imageShown: true, info: "You, Mark and PXE pooled together the information you knew and \\nlooked around for clues. Through trials and tribulations \\nyou collected the items needed for a ritual which brought you to \\nthe Sea Goddess' bishop. After a battle with her, you obtained a \\ntreasure of the zone, and came to the conclusion each zone \\nmust have a similar treasure. You and Mark went seperate ways \\nto search for these treasures and you ran into a woman named \\nAlaru. After helping her save a town from monsters, \\nshe joined your party and offered to guide you to the next zone.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Eurus Sea", icon: 8867 },
        { name: "The Demon Zone", category: "story", switch: 1443, imageShown: true, info: "With Alaru in tow you reached the Demon Zone, but a mysterious \\nmagic seperated your group and left you alone in a city \\ncontrolled by demons. A friendly doppelganger there even helped you \\nunlock a new power, to steal the abilities of your foes. Using this \\nnew power you fought back against the demons and their \\nleader, Alaru's sister Amarya. With Amarya defeated Alaru \\nasked for your assistance, taking down her vampire mother. \\nAfter avoiding a strange, gun-toting biker, the two of you \\nreached the vampire's castle and took her down.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Elysium City", icon: 8867 },
        { name: "The Desolate Zone", category: "story", switch: 1444, imageShown: true, info: "Alaru stayed behind to watch over her family and you entered \\nthe Desolate Zone with only PXE at your side. She was quickly \\nstripped away by Robin, as she had grown beyond her AI constraints. \\nWith only a glitching AI at your side you continued on. You were \\neven bit by a zombie, and travelled alongside another \\nplayer named Kim to search for a cure. The biker showed up \\nagain, causing chaos as she went. Eventually you reached a \\nmansion, with a hacker-turned scientist within. She had to be \\nput down after going to far with her experiments however.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Mansion Approach", icon: 8867 },
        { name: "The Desert Zone", category: "story", switch: 1445, imageShown: true, info: "You reached the burning sands of the Desert alongside Kim and \\nencountered other adventurers, Dominic and Fera, also intent on \\nfinding the zone treasure. Goals aligned, you teamed up and together \\nuncovered a great pyramid. Dominic stormed forward without \\nyou and got himself possessed by an ancient spirit who \\ncaptured the rest of you. With the help of a ghostly goddess \\nyou managed to break free, rescue your allies, and defeat \\nthe new pharaoh. She cursed you as she died, but all was well \\nin the end and a repentant Domninic even joined the party.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Western Dunes", icon: 8867 },
        { name: "Back to the City", category: "story", switch: 1446, imageShown: true, info: "Looking for a way to remove the pharaoh's curse so you could \\nleave the desert the goddess Isis pointed you towards her daughter \\nBastet. She would remove the curse for a price, and you headed \\nback to the Desolate Zone to retieve a magic collar. The city \\nwas beset by wolves under the control of the biker Lina. \\nYou and Kim took down a hacker creating more collars and \\nproceeded to chase down Lina herself. Your bikes crashed and \\nshe had you at gunpoint, but Kim somehow managed to reflect \\nthe shot and defeat the biker.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Barricade Turf", icon: 8867 },
        { name: "The Mythic Zone", category: "story", switch: 1447, imageShown: true, info: "Your party recieved an invitation to a royal ball when you \\nentered the Mythic Zone which you accepted. The invitation was from \\nthe King himself, begging you to find his missing daughter. \\nAt the same time you realised Fera had been kidnapped. Intent \\non saving both you ventured out, falling prey to a trap \\nthat left you stuck in the princess' body for a while and \\ngetting tricked by Robin into believing Fera was actually in \\ndanger from shrine maidens. The princess was saved, and \\nFera embraced a new purpose as a guardian.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Mirane", icon: 8867 },
        { name: "The Mythic Zone", category: "story", switch: 1448, imageShown: true, info: "There was one more thing to do in the Mythic Zone. Help PXE. \\nStill glitching from Robin's attack the only way to help her was \\nfinding the other fae. This quest lead you in to the woods and to \\na strange realm called The Gleaming. There you collected \\n'letters of introduction' from the rulers there to meet Queen Titania. \\nTitania was actually a computer program in charge of creating \\nPXEs for Robin and captured you all. Your own mind glitching, you \\nmanaged to rescue the others and even restore PXE to normal, \\nfighting back against Titania and escaping the realm.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Mirane", icon: 8867 },
        { name: "The Breachwoods", category: "places", switch: 1402, imageShown: true, info: "The Breachwoods encompase the entirety of the Forest Zone, \\nfeaturing many interesting locations like cave systems and rivers. \\nHumans also make their home in the forest as seen by the northern \\nBreachwood Village and Caste City to the south. Some ranchers \\nhave also been known to turn clearings into areas for livestock.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Breachwoods", icon: 8866 },
        { name: "Caste City", category: "places", switch: 1403, imageShown: true, info: "Stuck between the Breachwood Forest and the ocean beyond, this \\nhuman city boasts walls of high stone, strong enough to withstand \\nany monster's attack. But all walls crumble eventually.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Caste City", icon: 8866 },
        { name: "Eurum City", category: "places", switch: 1404, imageShown: true, info: "Rather small for a city, this quaint tropical paradise lies on the \\nedge of the Eurus Sea. The north road takes you up to the Budan \\nRiver, while the east heads toward the forest zone. Like most places \\nby the sea, the local trade is fishing.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Eurum City", icon: 8866 },
        { name: "Eurus Sea", category: "places", switch: 1405, imageShown: true, info: "This vast sea is enclosed by sharp, deadly rocks. It is said this is \\nthe reason for it's high concentration of deadly monsters, many \\ncreatures make their homes here from the peaceful Sea Slimes to \\nthe deadly Mershark. Supposedly the entire sea is protected \\nby a goddess.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Eurus Sea", icon: 8866 },
        { name: "Budan River", category: "places", switch: 1406, imageShown: true, info: "A wide, gentle river that splits the Coastal Zone in half, the \\nBudan is home to many different races. From the humans living the \\nisland village to the sahaguin's hiding out in the caves and the \\nupper banks. Unlike the nearby city of Eurum, or the island of \\nDirian, the humans living on the Budan don't believe in the Sea \\nGoddess, perhaps because of their frequent clashes with their \\nmonstrous neighbours.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Budan River", icon: 8866 },
        { name: "Elysium City", category: "places", switch: 1407, imageShown: true, info: "Nestled within a decaying forest and surrounded by thick \\nimpenetrable walls lies the city of Elysium, named for the ancient \\ntale of a blessed plain, this was once a place of beauty and \\nhappiness but with corruption seeping into the roots the town is \\nnow nothing but a shell of it's former self. Dark work goes on \\nbehind closed doors and evil sets in motion plans for the innocent \\ncivilians that call it home. In the center of the sickly river lies \\nthe shining beacon of Elysium, it's great cathedral.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Elysium City", icon: 8866 },
        { name: "Hilltop Castle", category: "places", switch: 1408, imageShown: true, info: "From the dark sewers to the tallest tower, this castle is one \\nimposing structure. Owned long ago by a human noble, the castle is \\nnow the home of the Vampire Queen Draculara and her kin. The \\ncastle itself looms over the city of Elysium, as per the request of \\nit's original owner for some long forgotten reason. The sewers far \\nbelow are quite the twisting maze of tunnels, supposedly reaching \\nas far as the Desolate Zone and are inhabited by ratfolk and \\ngator alike.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Hilltop Castle", icon: 8866 },
        { name: "Barricade Turf", category: "places", switch: 1409, imageShown: true, info: "On the western edge of the city that makes up the Desolate Zone, \\nlies a town created around the St.Robin's Memorial Hospital. Here, \\nthe inhabitants fight bravely to defend their new home and their \\nfriends. Zombies swarm outside the hastily built walls and armed \\nguards fight on, desperate for the hordes to stop. The only saving \\ngrace being that other monsters seem to fear the zombies as much \\nas humans and haven't shown themselves since the horde arrived.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Barricade Turf", icon: 8866 },
        { name: "Mansion Approach", category: "places", switch: 1410, imageShown: true, info: "East of the river that divides the zone, a mall holds this area's \\nsuriving humans, whether they be players or NPCs. The outside \\nstreets from the mall's exterior to the outskirts of the city park \\nare swarming with zombies, wandering like lost children. And at the \\nedge of the long road sits a old fashioned mansion, out of place \\namong the city sights. A place known as one where many \\nadventurers enter, looking for loot and rewards, but none ever leave.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Mansion Approach", icon: 8866 },
        { name: "Northern Streets", category: "places", switch: 1411, imageShown: true, info: "Sitting in the shadow of the looming mountains, the northern roads \\nof the city are long and fraught with danger. With the zombies \\nfinally expelled the true owners of the city have returned, monsters \\nof all kind have flocked to the area in hopes of catching some lone \\nhuman as prey. On the eastern side of the river lies a safe place, \\noriginally a part of Barricade Town, but now cut off from it's sister \\ntown. The town still goes unnamed however, as its people have more \\nimportant things to worry about.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Northern Streets", icon: 8866 },
        { name: "Western Dunes", category: "places", switch: 1412, imageShown: true, info: "Atop a dusty hill lies a small camp, safe from the sandwurms that \\nroam the sands. The nearby river provides fresh water from the \\nmountains and keeps the shores green and bountiful. Even so, not all \\nis safe here. An evil lurks just beneath the surface, festering and \\ngrowing stronger as it waits to emerge. Ruins and lonely pillars \\ndot the dunes, memories of days long past, or perhaps a prophecy \\nfor the future.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Western Dunes", icon: 8866 },
        { name: "Eastern Dunes", category: "places", switch: 1413, imageShown: true, info: "A dried up dead riverbed, a dusty mirror of the western desert. \\nOverlooking it lies the town of Djeso, protected from the harsh \\nsandstorms and wurms by it's high walls. The citizens, clustered \\naround their little oasis, can still see the volcano over the walls, \\nor at least its plume of black smoke. Few dare to venture close, \\nfor fear of the lava, and the volcano's fiesty, scaled inhabitants. \\nIt said Djeso was originally built by miners from a place beyond the \\nmountains that enshroud the desert.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Eastern Dunes", icon: 8866 },
        { name: "Mirane Captial", category: "places", switch: 1414, imageShown: true, info: "The captial city of the Kingdom of Mirane, a walled bastion against \\nthe monsters and inhumans of the woods. Densely packed together \\nhouses and shops make up the poorer parts of downtown. \\nComfy homes, opens markets and fancy shops decorate the midtown. \\nNo matter where you are however, you're always in the shadow \\nof the castle.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Mirane", icon: 8866 },
        { name: "Mystic Woods", category: "places", switch: 1415, imageShown: true, info: "Thick and misty, it's not hard to lose ones way within the trees \\nof the Mystic Woods. Entry is barred to most due to the danger \\nwithin and those that do enter often find themselves with the \\nfeeling of being watched. A few brave or perhaps foolish \\nsouls make their home within, most notably the shrine maidens, \\nwho have carved out a place of safety and sanctuary not just \\nfrom the woods inhabitants.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Mystic Woods", icon: 8866 },
        { name: "The Gleaming", category: "places", switch: 1416, imageShown: true, info: "An shadow of reality where the fae make their home. Ordered and \\nchaotic at the same time, The Gleaming is a place not suited to \\nhumans or the inhabitants of 'Humdrum' as the fae call them. \\nThose living here have seperated themselves into three courts, \\nruled by the most powerful fae around, who hoard their stolen \\nriches of memories and lives. Even the fae fear what lies \\nabove however, the home of their true ruler. The Emerald \\nShadow is home to 'Queen Titania', supposedly a fae so powerful \\nand unsettling that even the court leaders fear her.",
          folder: "Graphics/Encyclopedia/Topics/Places/", image: "Gleaming", icon: 8866 },
        { name: "PXE", category: "people", switch: 211, imageShown: true, info: "This adorable little fairy is your 'Personal Xanadu Expert' an \\nincredibly helpful little AI. While all players of Monline start \\nwith their own PXE most disable theirs quickly. Supposedly some \\nplayers find the PXE's 'annoying'.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "PXE", icon: 8865 },
        { name: "PXE", category: "people", switch: 212, imageShown: true, info: "Your 'Personal Xanadu Expert', after an encounter with Robin she was \\n'reset' in an attempt to quell her fury towards the game's \\ncreator. Now she is in a constant state of glitching.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "PXE 2", icon: 8865 },
        { name: "PXE", category: "people", switch: 213, imageShown: true, info: "Fixed of her glitches, and her memory restorted, PXE is working at \\nfull functionality. After the events at the Emerald Shadow PXE \\nProcessing Facility left her the sole survivor of her 'species', \\nshe has vowed to help humanity fight back against Robin.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "PXE 3", icon: 8865 },
        { name: "Robin", category: "people", switch: 201, imageShown: true, info: "The ruler of the world of Monline and the one who trapped everyone \\nhere. Supposedly the sole designer of Monline, although you never \\ntook much notice of the developer's names during the game's \\nproduction. Robin appears to have a love of transformation and \\nhas roped the entire playerbase into being the victims of their \\ntwisted game.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Robin", icon: 8865 },
        { name: "Mark", category: "people", switch: 202, imageShown: true, info: "Just another player who started out in the Forest Zone like you. \\nSo far you've both saved each other from near certain doom.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Mark", icon: 8865 },
        { name: "Mark ", category: "people", switch: 209, imageShown: true, info: "Just another player who started out in the Forest Zone like you. \\nSo far you've both saved each other from near certain doom. \\nAfter defeating the Sea Bishop and obtaining the first Orb, the \\ntwo of you decided to part ways in search of the others. Him heading \\nwest, you heading east. Hopefully it won't take long for you \\nboth to reunite.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Mark", icon: 8865 },
        { name: "Percy", category: "people", switch: 1401, imageShown: true, info: "Despite the strange goings on around him this one seems to care \\nvery little for his own safety and instead spends his time \\ndocumenting each of the monsters he encounters.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Percy", icon: 8865 },
        { name: "Aralu", category: "people", switch: 203, imageShown: true, info: "Aralu is a rather strange woman obsessed with doling out justice \\nto the monsters that roam the island.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Aralu", icon: 8865 },
        { name: "Aralu ", category: "people", switch: 208, imageShown: true, info: "Child of the Vampire Queen Draculara, Aralu is a Dhampir, a \\nhalf-vampire half-human hybrid. Fearful of becoming like her mother \\nshe ran away and began enacting justice on those who couldn't \\ncontrol their inhuman impulses, the monsters of Xanadu. With your \\nhelp she defeated her sister, the High Succubus Amarya, and slayed \\nher mother. Now she resides in the castle above Elysium City, \\nteaching her younger siblings in hopes they may turn out like her.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Aralu", icon: 8865 },
        { name: "Kim", category: "people", switch: 204, imageShown: true, info: "After meeting Kim at the edge of the Desolate Zone she's joined up \\nwith you as an attempt to find the source of the zombie outbreak \\nand avenge her friend.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Kim", icon: 8865 },
        { name: "Kim", category: "people", switch: 210, imageShown: true, info: "After meeting Kim at the edge of the Desolate Zone she joined up \\nwith you as an attempt to find the source of the zombie outbreak \\nand avenge her friend. With the mad scientist Mara defeated, the \\ntwo of you continued on together, determined to defeat Robin and \\nsave the people trapped in this world. She's kind-hearted and \\nintelligent, though she has a fierce temper and is just a slight \\nbit too naive at times.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Kim", icon: 8865 },
        { name: "Lina", category: "people", switch: 204, imageShown: true, info: "A vile woman who relishes the power the world of Monline has given her \\nover others. Formerly working under the scientist Mara, \\nshe fled when the woman turned lich was defeated and her \\nwhereabouts are now unknown.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Lina", icon: 8865 },
        { name: "Lina", category: "people", switch: 216, imageShown: true, info: "Her evil actions have finally caught up with her, having fallen prey \\nto a reflected shot from her own Bimboizing Ray Gun \\nthis happy-go-lucky biker remembers nothing of her former self. \\nIt's probably better that way for everyone.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Lina 2", icon: 8865 },
        { name: "Morgan", category: "people", switch: 204, imageShown: true, info: "Having lost his own party and friends early on during his adventure, \\nthis man has turned to any means necessary to survive, \\neven allying with the scientist Mara and her immoral experiments.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Morgan", icon: 8865 },
        { name: "Morgan", category: "people", switch: 218, imageShown: true, info: "Having lost his own party and friends early on during his adventure, \\nthis man has turned to any means necessary to survive. \\nDuring your time in the Pyramid he willingly worked with the Pharaoh \\nFarinet so as not to suffer the fate of her 'subjects'.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Morgan", icon: 8865 },
        { name: "Dominic", category: "people", switch: 205, imageShown: true, info: "In the real world he was a popular streamer called 'DMO', and was \\nknown for his actions in many other games. In Monline he is just as \\npopular with his fans and is using them to hunt down the Desert \\nZone's treasure. \\nHe seems to be friends with the wildwoman Fera.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Dominic", icon: 8865 },
        { name: "Dominic", category: "people", switch: 214, imageShown: true, info: "After a not so impressive introduction where he fought against you \\nat Morgan's side and was possessed by a Pharaoh, Dominic joined \\nyour team to make amends for his failure, at the request of his \\nfriend Fera. More than a little vain and popularity obsessed, \\nDominic also goes by the online handle 'DMO' to his streams viewers.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Dominic", icon: 8865 },
        { name: "Fera", category: "people", switch: 206, imageShown: true, info: "A rather strange woman, Fera is mostly quiet and prefers to talk \\nin short stilted sentences or animal like growls. She allied \\nherself with the group in order to stop her friend Dominic from \\nmaking a foolish mistake. Despite her somewhat standoffish \\npersonality she has an odd sense of humour that she is not afraid to \\nshow off.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Fera", icon: 8865 },
        { name: "Fera", category: "people", switch: 220, imageShown: true, info: "Claiming herself to be an 'actor' of sorts, this roleplayer has \\ngracefully accepted her new role as shrine maiden and host to \\nthe Kitsune spirit. Kitsune worked to protect those from Robin's \\ncorruption and all was going well until you stumbled in and \\nruined everything. Despite everything her personality hasn't changed and \\nshe still seems to enjoy teasing others, especially with a prankster \\nspirit within her.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Fera 2", icon: 8865 },
        { name: "Delta", category: "people", switch: 219, imageShown: true, info: "A self proclaimed genius hacker who worked with Lina to design \\nmind controlling collars for her. He used the collars to create \\nhis own harem of slaves before being stopped by you and Kim. \\nAfter running back to Lina with his tail between his legs she \\nbetrayed and collared him turning him into the loyal dog-like gremlin \\nshe is now. After Lina was defeated Delta fled and her whereabouts \\nare now unknown.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Delta", icon: 8865 },
        { name: "Princess Rien", category: "people", switch: 207, imageShown: true, info: "Heir to the throne of Mirane, she was formerly missing after \\nrunning away to hunt down her friend's kidnapper and getting herself \\npetrified. During the hunt for her your ran into a magical trap she \\nset and ended up as her 'replacement'. \\nShe is prim and proper but with a fiesty personality, and \\nthe magical prowess to back that up.",
          folder: "Graphics/Encyclopedia/Topics/People/", image: "Rien", icon: 8865 },
        { name: "Death", category: "states", switch: 0, imageShown: false, info: "The afflicted won't be able to fight, use items or guard! \\nThis state is automatically applied when you run out of HP.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 224 },
        { name: "Poison", category: "states", switch: 0, imageShown: false, info: "At the end of the turn the affected person will take damage based \\non their MAT stat, this effect cannot cause death. \\nLasts 1-5 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 225 },
        { name: "Blind", category: "states", switch: 0, imageShown: false, info: "Lowers the afflicted's chance to hit by 40%. \\nLasts 1 turn.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 226 },
        { name: "Sealed", category: "states", switch: 0, imageShown: false, info: "The afflicted cannot use any Abilities while Sealed! \\nLasts 2-3 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 227 },
        { name: "Enraged", category: "states", switch: 0, imageShown: false, info: "The afflicted attacks at random and can even hit their allies! \\nLasts 2-4 turns. 50% chance to be removed when taking damage.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 9058 },
        { name: "Sleep", category: "states", switch: 0, imageShown: false, info: "The afflicted cannot act or evade attacks. \\nLasts 2-3 turns. Removed when taking damage.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 229 },
        { name: "Paralysis", category: "states", switch: 0, imageShown: false, info: "The afflicted cannot evade attacks. \\nLasts 1-3 turns. 50% chance to be removed when taking damage.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 230 },
        { name: "Stun", category: "states", switch: 0, imageShown: false, info: "The afflicted cannot act or evade attacks. \\nLasts 1 turn. 50% chance to be removed when taking damage.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 231 },
        { name: "Provoke", category: "states", switch: 0, imageShown: false, info: "The afflicted is far more likely to be targeted. \\nLasts 3 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 362 },
        { name: "HP Regen", category: "states", switch: 0, imageShown: false, info: "Increases the afflicted's HP Regeneration Rate by 6%. \\nLasts 4 turns. 40% chance to be removed when taking damage.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 356 },
        { name: "MP Regen", category: "states", switch: 0, imageShown: false, info: "Increases the afflicted's MP Regeneration Rate by 6%. \\nLasts 4 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 375 },
        { name: "AD Regen", category: "states", switch: 0, imageShown: false, info: "Increases the afflicted's AD Regeneration Rate by 8%. \\nLasts 4 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 354 },
        { name: "Ironbody", category: "states", switch: 0, imageShown: false, info: "The afflicted takes 30% less damage from Physical Attacks. \\nLasts 3 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 352 },
        { name: "Frisky", category: "states", switch: 0, imageShown: false, info: "The afflicted takes double damage from Lust based attacks and is \\n25% more likely to become Charmed. The afflicted gains AD as 125% \\nthe normal rate and their weapon attacks do Lust damage. \\nLasts 2-3 turns. 20% chance to be removed when taking damage.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 12013 },
        { name: "Calm", category: "states", switch: 0, imageShown: false, info: "The afflicted gains 3% HP and MP Regeneration, takes 10% less \\ndamage and has a 25% chance to be able to act twice. The afflicted \\nalso cannot be inflicted with Frisky or Enraged. \\nLasts 4 turns. 20% chance to be removed when taking damage. \\nIf the state is removed due to lasting the full 4 turns, the \\nafflicted becomes Exhausted.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 9056 },
        { name: "Risen", category: "states", switch: 0, imageShown: false, info: "The afflicted's ATK and MAT stats are increased by 25%. \\nTypically applied after being revived. \\nLasts 2 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 373 },
        { name: "Flurry", category: "states", switch: 0, imageShown: false, info: "The afflicted gains an extra action each turn, and a 50% chance to \\ngain an additional extra action each turn. \\nLasts 2 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 398 },
        { name: "Burned", category: "states", switch: 0, imageShown: false, info: "The afflicted's healing rate from abilties and items is reduced \\nby 25%. At the end of the turn the affected person will take damage \\nbased on their ATK stat, this effect cannot cause death.  \\nLasts 3-4 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 9057 },
        { name: "Chilled", category: "states", switch: 0, imageShown: false, info: "The afflicted's attack speed is reduced by 10 stages. \\nTheir Evasion rate is also reduced by 50%. \\nLasts 3-4 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 353 },
        { name: "Stinky", category: "states", switch: 0, imageShown: false, info: "The afflicted's healing rate from abilities and items is reduced by 50%. \\nLasts 3-5 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 382 },
        { name: "Dizzy", category: "states", switch: 0, imageShown: false, info: "\"The afflicted's Evasion and Hit rates are reduce \\nby 50%. Every time they attack they'll take damage \\nbased on their ATK or MAT stat. Lasts 1-3 turns. \\n50% chance to be removed when taking damage.\",                                  :image? => false",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 228 },
        { name: "Exhaustion", category: "states", switch: 0, imageShown: false, info: "The afflicted can't move and takes double damage. \\nLasts 2 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 383 },
        { name: "Anchored", category: "states", switch: 0, imageShown: false, info: "The afflicted is immune to Stun, Dizzy, Paralysis and Sleep. \\nLasts 3 turns.",
          folder: "Graphics/Encyclopedia/Topics/", image: "Extra", icon: 9060 },
        { name: "Basic Controls", category: "tips", switch: 0, imageShown: true, info: "Arrow Keys: Move on the map, move the menu cursor. \\nZ: Interact, Select Menu Option. \\nX: Cancel. \\nA: Hides the Text Box. \\nShift: Toggles Sprint on the map. \\nCtrl: Speeds up text. \\nF6: Change Screen Size. \\nF12: Return to the Title Screen (Unstable!)",
          folder: "Graphics/Encyclopedia/Topics/Other/", image: "BasicControls", icon: 8869 },
        { name: "QTE Controls", category: "tips", switch: 0, imageShown: true, info: "At times, while exploring the world you maybe be \\nrequired to act quickly and input a series of specific \\nkey presses to proceed. If you fail to press the \\ncorrect keys in order before time runs out there may \\nbe dire consequences. The keys you may be asked to \\npress are: Z, X, Q, W, A, S, D, Shift and the Arrow Keys.",
          folder: "Graphics/Encyclopedia/Topics/Other/", image: "QTEControls", icon: 8869 },
        { name: "Combat Controls", category: "tips", switch: 0, imageShown: true, info: "Arrow Keys: Move the menu cursor. \\nZ: Select a character's action. \\nX Move to the combat overview menu. \\nShift: Examine the highlighted target. \\nQ & W: Switch info screens for the examined target.",
          folder: "Graphics/Encyclopedia/Topics/Other/", image: "CombatControls", icon: 8869 },
        { name: "Main Stats", category: "tips", switch: 0, imageShown: true, info: "The gear you equip and the abilities you take will factor \\nheavily into your character's stats. \\nSpecifically, the six Main Stats: \\nAttack: Damage you deal with physical attacks.\\nDefense: Damage you take from physical attacks.\\nMagic Attack: Damage you deal with magical attacks.\\nMagic Defense: Damage you take from magical attacks.\\nAgility: Order characters will act in battle.\\nLuck: Chance you will evade attacks, and to critically hit.",
          folder: "Graphics/Encyclopedia/Topics/Other/", image: "MainStats", icon: 8869 },
        { name: "Extra Stats", category: "tips", switch: 0, imageShown: true, info: "There are variety of secondary stats the can also have an \\nimportant effect in battle. \\nSome are calculated using other stats. \\nHit Rate: Calculated from your ATK and AGI. \\nEvasion Rate: Calculated from your AGI and LUK. \\nCritical Rate: Calculated from your LUK. \\nGuard Rate: Calculated from your DEF and MDF.",
          folder: "Graphics/Encyclopedia/Topics/Other/", image: "ExtraStats", icon: 8869 },
        { name: "Cheat Codes", category: "tips", switch: 0, imageShown: true, info: "Using the 'Cheats' option on the main menu, you can \\naccess the cheat code input screen. Here you'll be able to \\ninput codes with a wide variety of effects, from unique \\nstarting equipment to skipping entire parts of the game.\\nExample Codes:\\nSKIP1 : Skip the intro, starting in Caste City \\nSKIP3 : Skip to the end of the Coastal Zone \\nRosebud : Add 1000G to the next loaded save file \\nAnd many more!",
          folder: "Graphics/Encyclopedia/Topics/Other/", image: "CheatCodes", icon: 8869 },
        { name: "Fate Locked", category: "tips", switch: 0, imageShown: true, info: "During gameplay there may be times when you have \\nwandered into an inescapeable situation. \\nWhen these situations occur, your fate will be 'locked' and \\nan overlay will appear around the edges of the screen. \\nThis is a warning to be careful about saving the game, even \\nthough you can, doesn't mean you should. Unless you really \\nwant to come back to that helpless state. Definitely not. \\nNote: Not all inescapable situations have been updated to \\nshow the overlay. You have a lot of save slots, use them!",
          folder: "Graphics/Encyclopedia/Topics/Other/", image: "FateLock", icon: 8869 }
    ];

    //-------------------------------------------------------------------------
    // Pedia_Particles (0146.rb:1377) - only runs when Particles[:enable?]
    //-------------------------------------------------------------------------
    function Pedia_Particles() { this.initialize.apply(this, arguments); }
    Pedia_Particles.prototype = Object.create(Sprite.prototype);
    Pedia_Particles.prototype.constructor = Pedia_Particles;

    Pedia_Particles.prototype.initialize = function () {
        Sprite.prototype.initialize.call(this);
        this.setup();
        this._animType = null;
    };
    Pedia_Particles.prototype.setup = function () {
        var a = Particles.animation;
        this._speed = a.speed1_min + Math.floor(Math.random() * (a.speed1_max - 1));
        this._speed2 = a.speed2_min + Math.floor(Math.random() * (a.speed2_max - 1));
        this._angletype = Math.floor(Math.random() * 2);
        this.bitmap = ImageManager.loadBitmap(
            'img/weather/', Particles.name[Math.floor(Math.random() * Particles.name.length)]);
        this.blendMode = Math.floor(Math.random() * 2);
        this.x = Math.floor(Math.random() * Graphics.boxWidth);
        this.y = !a.up && !a.down ? Math.floor(Math.random() * Graphics.boxHeight)
            : (a.up ? Graphics.boxHeight + Math.floor(Math.random() * Graphics.boxHeight)
                    : -Math.floor(Math.random() * Graphics.boxHeight));
        // RGSS centres on ox/oy; MV anchors on a fraction of the frame.
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
        var z = Math.floor(Math.random() * 2);
        this.scale.x = z;
        this.scale.y = z;
        this.opacity = 0;
    };
    // RGSS `angle` is counter-clockwise, MV rotation is clockwise.
    Pedia_Particles.prototype.animate = function () {
        var a = Particles.animation;
        if (a.up && !a.down) {
            if (this.y <= -50) { this.setup(); }
            this.y -= this._speed;
        }
        if (a.down && !a.up) {
            if (this.y >= Graphics.boxHeight + 50) { this.setup(); }
            this.y += this._speed;
        }
        if (a.right && !a.left) {
            if (this.x >= Graphics.boxWidth + 50) { this.setup(); }
            this.x += this._speed2;
        }
        if (a.left && !a.right) {
            if (this.x <= -50) { this.setup(); }
            this.x -= this._speed2;
        }
        if (this._angletype === 1) { this.rotation += Math.floor(Math.random() * 4); }
        else { this.rotation -= Math.floor(Math.random() * 4); }
        if (this.opacity < 255) { this.opacity += 2; }
    };

    //-------------------------------------------------------------------------
    // Pedia_Help (0146.rb:1537)
    //-------------------------------------------------------------------------
    function Pedia_Help() { this.initialize.apply(this, arguments); }
    Pedia_Help.prototype = Object.create(Window_Base.prototype);
    Pedia_Help.prototype.constructor = Pedia_Help;

    Pedia_Help.prototype.initialize = function (x, y, w, h) {
        Window_Base.prototype.initialize.call(this, x, y, w, h);
    };
    Pedia_Help.prototype.categoryText = function () {
        this.contents.clear();
        this.drawTextEx(Help.category_vocab, 0, 0);
    };
    Pedia_Help.prototype.topicText = function () {
        this.contents.clear();
        this.drawTextEx(Help.topics_vocab, 0, 0);
    };

    //-------------------------------------------------------------------------
    // Pedia_Category (0146.rb:1451)
    //-------------------------------------------------------------------------
    function Pedia_Category() { this.initialize.apply(this, arguments); }
    Pedia_Category.prototype = Object.create(Window_Selectable.prototype);
    Pedia_Category.prototype.constructor = Pedia_Category;

    Pedia_Category.prototype.initialize = function (x, y, w, h) {
        Window_Selectable.prototype.initialize.call(this, x, y, w, h);
        this.select(0);
        this.activate();
        this._data = [];
        this._commands = [];
        var self = this;
        Categories.forEach(function (cat) {
            if (!$gameSwitches || cat.switch === 0 || $gameSwitches.value(cat.switch)) {
                self._data.push(cat);
                self._commands.push(cat.name);
            }
        });
        this.execCommands();
    };
    Pedia_Category.prototype.maxItems = function () {
        return this._data ? this._data.length : 0;
    };
    Pedia_Category.prototype.item = function () {
        return (this._data && this.index() >= 0) ? this._data[this.index()] : null;
    };
    // 0146.rb:1489
    Pedia_Category.prototype.execCommands = function () {
        this.contents.clear();
        for (var c = 0; c < this._commands.length; c++) {
            if (this._data[c].icon) {
                this.drawIcon(this._data[c].icon, 4, this.lineHeight() * c);
            }
            this.drawCommand(this._commands[c], c, !!this._data[c].icon);
        }
    };
    // 0146.rb:1503
    Pedia_Category.prototype.drawCommand = function (com, ind, icon) {
        var x = icon ? 32 : 4;
        this.contents.drawText(com, x, this.lineHeight() * ind, this.width,
                               this.lineHeight(), 'left');
    };
    Pedia_Category.prototype.drawItem = function () {};

    //-------------------------------------------------------------------------
    // Pedia_Topics (0146.rb:1594)
    //-------------------------------------------------------------------------
    function Pedia_Topics() { this.initialize.apply(this, arguments); }
    Pedia_Topics.prototype = Object.create(Window_Selectable.prototype);
    Pedia_Topics.prototype.constructor = Pedia_Topics;

    Pedia_Topics.prototype.initialize = function (x, y, w, h) {
        Window_Selectable.prototype.initialize.call(this, x, y, w, h);
        this.visible = false;
        this.select(0);
        this._data = [];
        this._commands = [];
    };
    Pedia_Topics.prototype.maxItems = function () {
        return this._data ? this._data.length : 0;
    };
    Pedia_Topics.prototype.item = function () {
        return (this._data && this.index() >= 0) ? this._data[this.index()] : null;
    };
    // 0146.rb:1618
    Pedia_Topics.prototype.execCommands = function (cat) {
        this._data = [];
        this._commands = [];
        this.contents.clear();
        TOPICS.forEach(function (topic) {
            if (!$gameSwitches || topic.switch === 0 || $gameSwitches.value(topic.switch)) {
                if (topic.category !== cat) { return; }
                this._data.push(topic);
                this._commands.push(topic.name);
            }
        }, this);
        this.refresh();
        for (var c = 0; c < this._commands.length; c++) {
            if (this._data[c].icon) {
                this.drawIcon(this._data[c].icon, 4, this.lineHeight() * c);
            }
            this.drawCommand(this._commands[c], c, !!this._data[c].icon);
        }
        var guard = 0;
        while (this.index() >= this._data.length && guard++ < 100) { this.deselect(); }
        if (this.index() < 0) { this.select(0); }
    };
    Pedia_Topics.prototype.drawCommand = function (com, ind, icon) {
        var x = icon ? 32 : 4;
        this.contents.drawText(com, x, this.lineHeight() * ind, this.width,
                               this.lineHeight(), 'left');
    };
    Pedia_Topics.prototype.drawItem = function () {};

    //-------------------------------------------------------------------------
    // Pedia_Information (0146.rb:1698)
    //-------------------------------------------------------------------------
    function Pedia_Information() { this.initialize.apply(this, arguments); }
    Pedia_Information.prototype = Object.create(Window_Base.prototype);
    Pedia_Information.prototype.constructor = Pedia_Information;

    Pedia_Information.prototype.initialize = function (x, y, w, h) {
        Window_Base.prototype.initialize.call(this, x, y, w, h);
        this.visible = false;
    };
    // 0146.rb:1729 - `def reset_font_settings; end`.  The Ruby *empties* this
    // method so the configured font survives draw_text_ex, which calls it
    // first thing; without the same override MV's drawTextEx would reset the
    // size to 28px and every info paragraph would overflow the window.
    Pedia_Information.prototype.resetFontSettings = function () {
        this.contents.fontFace = Info_Main.font_name;
        this.contents.fontSize = Info_Main.font_size;
        this.changeTextColor('rgba(' + Info_Main.font_color.join(',') + ')');
        this.contents.outlineColor = 'rgba(0,0,0,1)';
        this.contents.outlineWidth = Info_Main.font_outline ? 3 : 0;
    };
    // 0146.rb:1721 - the info text is drawn from the top-left with the
    // escape-character pass, so \i[n] icons inside it render.
    Pedia_Information.prototype.displayInfo = function (text) {
        this.contents.clear();
        this.drawTextEx(String(text).replace(/\\n/g, '\n'), 0, -5);
    };

    //-------------------------------------------------------------------------
    // Encyclopedia (0146.rb:1072)
    //-------------------------------------------------------------------------
    function Encyclopedia() { this.initialize.apply(this, arguments); }
    Encyclopedia.prototype = Object.create(Scene_Base.prototype);
    Encyclopedia.prototype.constructor = Encyclopedia;

    Encyclopedia.prototype.initialize = function () {
        Scene_Base.prototype.initialize.call(this);
    };

    Encyclopedia.prototype.create = function () {
        Scene_Base.prototype.create.call(this);
        // Scene_Base#create is empty in MV - the window layer is made by
        // Scene_MenuBase, which this scene does not extend.
        this.createWindowLayer();
    };

    Encyclopedia.prototype.isReady = function () {
        return Scene_Base.prototype.isReady.call(this) && ImageManager.isReady();
    };

    // 0146.rb:1078
    Encyclopedia.prototype.start = function () {
        Scene_Base.prototype.start.call(this);
        this.execInstanceVariables();
        this.execBackground();
        this.execParticles();
        this.execAllWindows();
    };

    Encyclopedia.prototype.execInstanceVariables = function () {
        this._particles = [];
        this._globalMode = null;
        this._category = null;
        this._categoryBitmap = null;
        this._topicsBitmap = null;
        this._textIndex = null;
    };

    // 0146.rb:1090
    Encyclopedia.prototype.execAllWindows = function () {
        var W = Graphics.boxWidth, H = Graphics.boxHeight;
        var hh = Math.round(48 * scale());
        this._pediaHelp = new Pedia_Help(0, H - hh, W, hh);
        this._pediaHelp.categoryText();
        this.addWindow(this._pediaHelp);

        var cw = Math.floor(W * 0.4);
        var ch = H - this._pediaHelp.height;
        this._pediaCategory = new Pedia_Category(0, 0, cw, ch);
        this.addWindow(this._pediaCategory);

        this._pediaTopics = new Pedia_Topics(0, 0, cw, ch);
        this.addWindow(this._pediaTopics);

        var px = Math.round(180 * scale());
        var py = Math.floor(H * 0.3);
        var pw = W - px;
        var ph = (H - py) - this._pediaHelp.height;
        this._pediaInfo = new Pedia_Information(px, py, pw, ph);
        this._pediaInfo.visible = false;
        this.addWindow(this._pediaInfo);

        // The two full-screen picture sprites the Ruby layers at z=100.
        this._categorySprite = new Sprite();
        this._topicsSprite = new Sprite();
        // z=100 in the Ruby: above the windows, below the cursor/selection.
        this.addChildAt(this._categorySprite, 1);
        this.addChildAt(this._topicsSprite, 1);
    };

    // 0146.rb:1133
    Encyclopedia.prototype.execBackground = function () {
        this._background = new Sprite();
        if (Background.enable) {
            this._background.bitmap =
                ImageManager.loadBitmap('img/encyclopedia/', Background.name);
        } else {
            this._background.bitmap = SceneManager.backgroundBitmap();
            // Ruby: @background.color.set(16, 16, 16, 128) - a blend colour,
            // not a tone, so MV's setBlendColor is the right call.
            this._background.setBlendColor([16, 16, 16, 128]);
        }
        // The window layer already exists (create() makes it), so the
        // background has to go in *underneath* it - Scene_MenuBase gets away
        // with plain addChild only because it builds the background first.
        this.addChildAt(this._background, 0);
    };

    Encyclopedia.prototype.execParticles = function () {
        if (!Particles.enable) { return; }
        for (var i = 0; i <= Particles.amount; i++) {
            var p = new Pedia_Particles();
            this._particles.push(p);
            this.addChild(p);
        }
    };

    // 0146.rb:1186
    Encyclopedia.prototype.update = function () {
        Scene_Base.prototype.update.call(this);
        if (Input.isTriggered('escape') && this._pediaCategory &&
            this._pediaCategory.active) {
            SoundManager.playCancel();
            this.popScene();
            return;
        }
        this.flipGlobalMode();
        this.flipMode();
        this.methodParticles();
        this.methodCategorySprites();
        this.methodTopicsSprites();
        this.methodInformation();
    };

    Encyclopedia.prototype.flipGlobalMode = function () {
        this._globalMode = this._pediaCategory.active ? 'category' : 'topics';
    };

    Encyclopedia.prototype.flipMode = function () {
        if (this._globalMode === 'category') {
            if (Input.isTriggered('ok')) {
                SoundManager.playOk();
                this.flipTopics();
            }
        } else if (this._globalMode === 'topics') {
            if (Input.isTriggered('escape')) {
                SoundManager.playCancel();
                this.methodTopicsHide();
            }
        }
    };

    Encyclopedia.prototype.flipTopics = function () {
        var data = this._pediaCategory.item();
        this._category = data ? data.symbol : null;
        this.methodCategoryHide();
    };

    Encyclopedia.prototype.methodCategoryHide = function () {
        this._pediaCategory.deactivate();
        this._pediaCategory.visible = false;
        this._pediaHelp.topicText();
        this._pediaTopics.execCommands(this._category);
        this._pediaTopics.visible = true;
        this._pediaInfo.visible = true;
        this._topicsSprite.visible = this._pediaTopics._data.length > 0;
        this._pediaTopics.activate();
    };

    Encyclopedia.prototype.methodTopicsHide = function () {
        this._pediaTopics.deactivate();
        this._pediaTopics.visible = false;
        this._pediaInfo.visible = false;
        this._topicsSprite.visible = false;
        this._pediaHelp.categoryText();
        this._pediaCategory.visible = true;
        this._categorySprite.visible = true;
        this._pediaCategory.activate();
    };

    Encyclopedia.prototype.methodInformation = function () {
        var data = this._pediaTopics.item();
        if (!data) { return; }
        if (this._textIndex !== data.info) {
            this._textIndex = data.info;
            this._pediaInfo.displayInfo(data.info);
        }
    };

    Encyclopedia.prototype.methodParticles = function () {
        if (!Particles.enable) { return; }
        this._particles.forEach(function (p) { p.animate(); });
    };

    // 0146.rb:1323 - the topic picture for the highlighted entry
    Encyclopedia.prototype.methodCategorySprites = function () {
        var data = this._pediaCategory.item();
        if (!data) { return; }
        var key = data.symbol;
        if (this._categoryBitmap !== key) {
            this._categoryBitmap = key;
            this._categorySprite.bitmap = topicSprite(data);
        }
    };

    Encyclopedia.prototype.methodTopicsSprites = function () {
        var data = this._pediaTopics.item();
        if (!data) { return; }
        var key = data.folder + data.image;
        if (this._topicsBitmap !== key) {
            this._topicsBitmap = key;
            this._topicsSprite.bitmap = topicSprite(data);
        }
    };

    Encyclopedia.prototype.terminate = function () {
        Scene_Base.prototype.terminate.call(this);
    };

    window.Encyclopedia = Encyclopedia;
    window.Pedia_Category = Pedia_Category;
    window.Pedia_Topics = Pedia_Topics;
    window.Pedia_Help = Pedia_Help;
    window.Pedia_Information = Pedia_Information;
    MonlineEncyclopedia.Encyclopedia = Encyclopedia;
    MonlineEncyclopedia.TOPICS = TOPICS;
    MonlineEncyclopedia.Categories = Categories;

    console.log('[MonlineEncyclopedia] loaded');
})();
