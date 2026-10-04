//=============================================================================
// MonlineBadEnds.js
//=============================================================================
/*:
 * @plugindesc The Bad End roster (306 endings) and the Bad End collection
 * gallery that the title screen's Achieve command was always meant to open.
 * @author Monline port
 *
 * @param Title Command
 * @desc Label of the title-screen entry that opens the gallery.  Blank hides it.
 * @default Bad Ends
 *
 * @param Show Locked Hints
 * @desc Also show the "how to reach it" line for endings not yet discovered.
 * @default true
 * @type boolean
 *
 * @param Remember Across Saves
 * @desc Keep the collection when a new game is started, the way a gallery
 * should.  Off means the list only reflects the current save file.
 * @default true
 * @type boolean
 *
 * @param Show Unlock Toast
 * @desc Pop a small "New Bad End" notice on the map when one is first recorded.
 * @default true
 * @type boolean
 *
 * @help
 * 0091.rb Scene_Title#command_achieve calls
 *
 *     picturecheck
 *     SceneManager.call(Scene_Picture_Gallery)
 *
 * and neither `picturecheck` nor `Scene_Picture_Gallery` is defined anywhere
 * in the 275 shipped scripts - the Achieve entry in Monline 0.9.8 is wired to
 * a class that does not exist.  This plugin supplies both, and backs the
 * gallery with the roster the game actually uses.
 *
 * Where the roster comes from
 *   Every bad end prints a literal banner as its last line of dialogue, e.g.
 *
 *     \ { \ { \ { Ending C31 - Once Bitten
 *
 * followed by a Control Switches command turning that ending's achievement
 * switch ON.  All 306 banners were mined out of the 510 maps, the common
 * events and the troops, so the names below are the game's own, not the
 * wiki's.  The two sources disagree in a few places (the wiki has no F92 and
 * numbers C31 one off), and the game wins.
 *
 * How it is recorded
 *   $dataSystem.switches 901-1206 are named `ACH: End A1` .. `ACH: End F92`,
 *   one per ending, 306 of them, and the events turn them ON at the end of
 *   each bad end.  That is the original's mechanism and it is what is read
 *   here.
 *
 *   Three of them were never wired up correctly.  C31 (Once Bitten), F24
 *   (Love is Stone-Blind) and one of F92's two events all wrote switch 906 -
 *   A6's switch - because the ending block was copy-pasted and the id never
 *   updated; switch 941 was left orphaned under the mangled name
 *   `ACH: End 35`.  Those eight commands now write their own switch (941,
 *   1138, 1206) and 941 is renamed `ACH: End C31`, so all 306 endings are
 *   individually collectable.  Nothing else in those events was touched.
 *
 * Because achievements live in normal switches they die with the save file,
 * which makes a gallery fairly pointless.  With Remember Across Saves on
 * (default) the plugin keeps its own record alongside them and the gallery
 * shows the union, so a fresh New Game still shows everything you have ever
 * found.
 *
 * Plugin commands
 *   BadEnds open                 open the gallery
 *   BadEnds mark A1              record one ending (also sets its switch)
 *   BadEnds unmark A1            forget one ending
 *   BadEnds reset                forget every ending
 *   BadEnds count                how many are recorded (for a variable/text)
 *
 * Script
 *   MonlineBadEnds.open()
 *   MonlineBadEnds.seenCount(), MonlineBadEnds.total()
 *   MonlineBadEnds.isSeen('A1'), MonlineBadEnds.mark('A1')
 */
//=============================================================================

var MonlineBadEnds = MonlineBadEnds || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // Roster - [[code, switch, name, trigger], ...] generated from the data
    //-------------------------------------------------------------------------
    var ROSTER = [
        ["A1",901,"Liar Liar","Lie to the mansion owner"],
        ["A2",902,"Addiction","Lose to the Holstaurus"],
        ["A3",903,"Honey Trap","Lose to a Honey Bee"],
        ["A4",904,"A True Honor","Lose to a Hornet"],
        ["A5",905,"Absolute Power","Lose to Arachne"],
        ["A6",906,"Slice of life","Eat the Cheese"],
        ["A7",907,"Fluid Hunt","Lose to the Slime"],
        ["A8",1023,"Stay Awhile and Listen","Exhaust all the questions for the tutorial girl"],
        ["A9",1024,"Hooters","Lose to the Owl Mage"],
        ["A10",1041,"A Ribbiting Existence","Lose to a Giant Frog"],
        ["A11",1042,"Sweet Behind","Lose to the Pollen Drunk Honey Bee"],
        ["A12",1044,"Pillars to the Temple","Lose to the Greenworm"],
        ["A13",1081,"A Cat is Fine Too","Lose to Mr. Minoh"],
        ["A14",1082,"Cat Called","Go upstairs as a blonde catgirl"],
        ["A15",1083,"Feline Fine","Go upstairs as a brunette catgirl"],
        ["A16",1084,"Heavy Petting","Give in to the collar as a blonde catgirl"],
        ["A17",1085,"The Cat's Meow","Give in to the collar as a brunette catgirl"],
        ["B1",908,"The Littlest Mermaid","Lose to a Mermaid"],
        ["B2",1017,"Beneath the Light","Lose to a Sea Goddess' Priestess"],
        ["B3",909,"'Under da Sea'","Wear the Red Beret"],
        ["B4",910,"Plenty of Fish in the Sea","Lose to the Sea Bishop as male"],
        ["B5",1020,"The Catch of a Lifetime","Lose to the Sea Bishop as a mermaid"],
        ["B6",911,"Charybdis Chow","Lose to Charybdis"],
        ["B7",912,"Boredom","Lose to Scylla as male"],
        ["B8",1019,"Outlet of Love","Lose to Scylla as a mermaid"],
        ["B9",913,"Deep Dark Depths","Lose to the Kraken as male, and accept her offer"],
        ["B10",914,"Die with Dignity?","Lose to the Kraken as male, and decline her offer"],
        ["B11",1021,"The Saviour","Lose to the Kraken as a mermaid"],
        ["B12",915,"Magic Cucumber","Lose to a Kappa"],
        ["B13",1018,"Kappativated","Lose to a Kappa in the Nereid Cave"],
        ["B14",916,"One Track Mind","Lose to a Sahaguin"],
        ["B15",917,"Sisters in Crime","Lose to the Nereid"],
        ["B16",918,"Backup Singer","Lose to the Siren"],
        ["B17",919,"Flow Rider","Lose to the Sea Slime"],
        ["B18",1034,"A Clean Slate","Lose to the Crab Girl"],
        ["B19",1035,"Coconut Grass","Drink the Bahama Mama"],
        ["B20",1038,"Humans is Stupid","Lose to a Sahaguin Raider"],
        ["B21",1039,"Saltwater Sweetie","Lose to the Flow Kelp"],
        ["B22",1040,"Love Beneath the Gaslight","Lose to the Human Raider"],
        ["B23",1043,"Physician, H-Eel Thyself","Lose to the Raider Leader"],
        ["C1",920,"Impressive","Lose to an Imp"],
        ["C2",921,"Imprisioned","Lose to the Arch Imp"],
        ["C3",922,"Good Impression","Accept the head Imp's offer after beating the Arch Imp when the kidnapped man has been transformed"],
        ["C4",1022,"Predator's Prey","Lose to a Warden Succubus"],
        ["C5",923,"What a Tool","Lose to the Lesser Succubus"],
        ["C6",924,"Every Suck You Take","Lose to the Pigtail Succubus"],
        ["C7",925,"Self Made King","Lose to a Succubus"],
        ["C8",926,"Pipe Dreams of Wet Dreams","Lose to Amarya as male"],
        ["C9",927,"Banana Split","Use 'split' as female"],
        ["C10",1025,"Head Hunting","Let the lust meter overflow three times as female"],
        ["C11",1026,"Reroll","Lose to Amarya as female"],
        ["C12",1027,"Filled with Faith","Lose to a Corrupted Nun"],
        ["C13",931,"Keeper of Confessions","Lose to the Dark Priest"],
        ["C14",1036,"The Flower Clad in Black","Lose to the Roper"],
        ["C15",932,"Resistance is Futile","Lose to Chastity"],
        ["C16",928,"Heaven on Earth","Lose to Sonia's Eternal Judgement"],
        ["C17",929,"Hell is Other People","Lose to Gaia's Eternal Punishment"],
        ["C18",930,"Bridging the Gap","Lose to the Twins in any other way"],
        ["C19",1028,"Like no one ever was","Enter the mirror and approach the paladins"],
        ["C20",933,"Ambience","Use the piano"],
        ["C21",936,"Poster Girl","Lose to a Witch and say \"Do I?\""],
        ["C22",937,"Broom Rider","Lose to a Witch and say \"No!\""],
        ["C23",934,"Attack of the Living Dildo!","Check Baphomet's wardrobe and fail the QTE"],
        ["C24",935,"On the Flipside","Enter the mirror and drink the Weakening Potion twice"],
        ["C25",938,"Baphomet's Boytoy","Drink the Weakening Potion twice, or let the timer run out"],
        ["C26",1029,"In the Driver's Seat","Lose to Baphomet and pass the QTE"],
        ["C27",1030,"Backseat Driver","Lose to Baphomet and fail the QTE"],
        ["C28",940,"Na na na na na na na na Were-Bat!","Lose to a Were-Bat"],
        ["C29",939,"Snap Trapper","Fail the alligator QTE"],
        ["C30",1031,"Gator Gangbanger","Lose to the Stranger"],
        ["C31",941,"Once Bitten","Lose to a Dhampir"],
        ["C32",942,"Pale Maiden","Lose to Aralu"],
        ["C33",943,"Drowned Regret","Lose to Draculara and enter Amarya's chambers"],
        ["C34",1032,"Her Legacy","Lose to Draculara and enter Aralu's chambers"],
        ["C35",1033,"Blue Blooded","Lose to Draculara and enter her throneroom"],
        ["C36",944,"In Control","Lose to the Dark Slime"],
        ["C37",1037,"A Tale as Old as Time","Fail at sorting the books 4 times"],
        ["C38",1045,"Love Bitten","Lose to a Mosquito"],
        ["D1",945,"The Zombie Whored","Fail to escape the zombies"],
        ["D2",946,"From My Cold Dead Hands","Lose to a Zombie on the Streets"],
        ["D3",947,"Let Me Patch You Up","Enter the lab in the Hospital as a nurse"],
        ["D4",948,"Quest for the Cure","Lose to a Zombie in the Hospital"],
        ["D5",949,"Drop Dead Gorgeous","Lose to a Zombie in the Mall"],
        ["D6",950,"Till Death Do Us Part","Lose to a Zombie in the Old Church"],
        ["D7",951,"Burger Baroness","Order the Super Special in the Mall"],
        ["D8",952,"All better now?","Use the shower on the Hospital's 3rd floor"],
        ["D9",953,"Bisexual Healing","Use the shower on the Hospital's 3rd floor with Kim in the party"],
        ["D10",954,"Squeaky Wheel Needs Grease","Get caught in the Wheelchair Event"],
        ["D11",955,"A Rock and a Hard Place","Lose to the Gargoyle"],
        ["D12",956,"Boys will be Boys","Spill the box in the Mall"],
        ["D13",957,"Stuck in Another World","Fail the QTE in the city park"],
        ["D14",958,"Pressed Wallflower","Fail the graffiti QTE"],
        ["D15",959,"Nice or Naughty?",""],
        ["D16",960,"Naughty or Nice?",""],
        ["D17",961,"Reindeer Games",""],
        ["D18",962,"By the Reins","Lose too many presents in the Santa minigame after getting a high score of at least 15"],
        ["D19",963,"Spineless","Fail the skeleton QTE"],
        ["D20",964,"A Bloody Mess","Lose to the Ghoul"],
        ["D21",965,"Queen Bitch","Lose to a Werewolf and submit to the alpha"],
        ["D22",966,"A Heated Affair","Lose to a Werewolf and leave the cave"],
        ["D23",967,"Dancing to a Different Tune","Drink several bottles of wine in the Strip Club"],
        ["D24",968,"Bouncing Busts of Blonde Bimbo Bunnies","Fall to the bunny curse in the Strip Club"],
        ["D25",969,"Cottontail","Manually remove the Bunnysuit in the Strip Club"],
        ["D26",970,"How I learned to stop","Get caught by the wandering slimes"],
        ["D27",971,"Slimed and Mind","Lose to the Parasite Slime"],
        ["D28",972,"Trapped!","Get caught by Kimccubus in the suburbs when she is running"],
        ["D29",973,"Corrupted","Get caught by Kimccubus in the suburbs when she is flying"],
        ["D30",974,"A Lust for Gold","Lose to the Mimic"],
        ["D31",975,"It's a trap!","Open the tan chest in the Warehouse"],
        ["D32",976,"No Strings Attached","Fail the minigame in the Warehouse"],
        ["D33",977,"Bustin' Makes Me Feel Good!","Lose to the Ghost"],
        ["D34",978,"Dolls Aren't Just for Little Girls!","Lose to the Living Doll"],
        ["D35",979,"A Match Forced in Heaven","Touch the flowers in the church, say I Do"],
        ["D36",980,"Unholy Matrimony","Fail to get properly ready before the wedding"],
        ["D37",981,"Linked by Love","Get ready for the wedding, say I Do"],
        ["D38",982,"I am the Law!","Fail to escape the jail"],
        ["D39",1056,"Default Settings","Lose to either robot as R0M-I, say \"Yes\""],
        ["D40",1057,"Quarantined","Lose to either robot as R0M-I, say \"No!\""],
        ["D41",1058,"Self-Made Girl","Lose to either robot as PXE"],
        ["D42",1059,"Conversion Therapy","Lose to either robot as Kim"],
        ["D43",1060,"Future Shock","Lose to PROXI"],
        ["D44",1061,"Danse Mechabre","Lose to Morgan and K8-II"],
        ["D45",1062,"A Step Forward","Get caught by Lina as ROM-I, please her"],
        ["D46",1063,"B1MB-0","Get caught by Lina as ROM-I, upset her"],
        ["D47",1064,"Cherry Fairy","Get caught by Lina as PXE"],
        ["D48",1065,"Ganguro Goddess","Lose to Lina"],
        ["D49",1066,"Don't lose your head!","Have the Player get Doomed"],
        ["D50",1067,"Lab Rat","Have Kim get Doomed"],
        ["D51",1068,"Out of Touch","Lose to Mara"],
        ["D52",1069,"Know Your Own Mind","Lose to Dark Lich Mara"],
        ["D53",1070,"Respawned","Lose to Robin"],
        ["D54",1071,"I know this Pretty Rave Girl","Fail Disco Disco Insurgency"],
        ["D55",1072,"Wet Nurse","Talk to Dr. Olsen after escaping the shower"],
        ["D56",1073,"What the Doctor Ordered","Attempt to escape Dr. Olsen after escaping the shower"],
        ["D57",1074,"Moonlit Dreams","Lose to the Wolf Brute"],
        ["D58",1075,"Homegrown Hunter","Get caught by Kimccubus inside the house"],
        ["D59",1076,"The Implication","Lose to Kimccubus"],
        ["D60",1077,"Fucking Evil But Still Tight","Lose to Dark Succubus Queen Kimara after losing to several other enemies"],
        ["D61",1078,"Always Fighting For What's Right!","Lose to Dark Succubus Queen Kimara"],
        ["D62",1079,"Clad in Latex and Midnight","Equip the Lovely Wand after using it to defeat Kimccubus"],
        ["D63",1080,"Joystuck","Use the Unlimited Ticket five times"],
        ["D64",1102,"Beware the Dog","Lose to the Collared Wolf"],
        ["D65",1103,"Nippon Daisuki","Succumb to Delta's control through Natsuki-chan"],
        ["D66",1104,"Milk of Human Kindness","Succumb to Delta's control through Cowtits"],
        ["D67",1105,"Pavlov's Puppy","Succumb to Delta's control through \"Mrrow\""],
        ["D68",1106,"New Girls Sweep Clean","Succumb to Delta's control through Phoebe"],
        ["D69",1107,"Smothered","Succumb to Delta's control through Emma"],
        ["D70",1108,"Running Red Lights","Succumb to Delta's control through Maid"],
        ["D71",1109,"The dIzzy-ing Heights of Love","Succumb to Delta's control through Honey"],
        ["D72",1110,"Live like a Human, Die like a Dog","Lose to the Collared Wolf or Collared Werewolf without Kim and answer 'truthfully'"],
        ["D73",1111,"This Town's Going to the Dogs","Lose to the Collared Wolf or Collared Werewolf without Kim and 'lie' once"],
        ["D74",1112,"Best in Show","Lose to the Collared Wolf or Collared Werewolf without Kim and 'lie' twice"],
        ["D75",1113,"Bitch and Moan","Lose to the Collared Wolf or Collared Werewolf without Kim and 'lie' for every question"],
        ["D76",1114,"Like they do on the Discovery Channel","Lose the Gremlin's game"],
        ["D77",1115,"Directive: Good Dog","Good Dog: Lose to the Gremlin"],
        ["D78",1116,"Star Crossed Lovers","Lose to Romeo, Deposed Alpha"],
        ["D79",1117,"Empty Vessels Make the Most Sound","Get hit by Lina during the motorcycle chase and lose to the ambush"],
        ["D80",1118,"Bimbo Backfire","Get hit by Lina during the motorcycle chase and lose to the bimbofied ambush"],
        ["D81",1119,"Power Overwhelming","Get hit by Lina during the motorcycle chase and fully bimbofy the ambush"],
        ["D82",1120,"Ride or Die","Get hit by Lina during the motorcycle chase and defeat the ambush"],
        ["D83",1123,"Anthro Anthropology","Lose to the Ratfolk"],
        ["D84",1124,"Wearing a Plastic Smile","Get caught by the mannequins in the Silk Store Quest"],
        ["E1",983,"Riddle Me This","Lose to the Sphinx"],
        ["E2",984,"Twice as Bright, Half as Long","Fail the Sphinx's first riddle"],
        ["E3",985,"The First of Nine.","Fail the Sphinx's second riddle"],
        ["E4",986,"What's in a name?","Fail the Sphinx's third riddle"],
        ["E5",987,"A Riddle wrapped in like, an Engima",""],
        ["E6",988,"The Mummy's Boy","Lose to the Mummy"],
        ["E7",989,"Are you my Mummy?","Lose to the Mummy and run out of time"],
        ["E8",990,"Singleminded","Get hit with the rolling black ball"],
        ["E9",991,"A Sellers Market","Lose to the Anubis"],
        ["E10",992,"Anubintervention","Lose to the pair of Anubi"],
        ["E11",993,"Pick Your Poison","Lose to the Manticore"],
        ["E12",994,"Cexigua","Lose to a tongueless Sandwurm"],
        ["E13",995,"Surrogacy","Get captured by the Echidna"],
        ["E14",996,"When You're Least Expecting","Lose in the first battle with the Echidna"],
        ["E15",997,"Cock Roach","Lose to a Devil Bug"],
        ["E16",998,"PermanAnt Residence","Lose to Ant Arachne"],
        ["E17",999,"A Web of Lies","Defeat Arachne, choose 'Another spider?' and fail the QTE"],
        ["E18",1000,"It's only Natural","Lose to the Mad Scientist after giving him a fossil from the Desert Underground"],
        ["E19",1001,"Go Down in Prehistory","Lose to the Mad Scientist after giving him the Horn Fossil"],
        ["E20",1002,"Outbreak","Equip the Harem Girl Outfit on all party members"],
        ["E21",1003,"Pricked","Drink the water"],
        ["E22",1004,"Ye Mighty, and Despair!","Enter the oasis in the desert and ask Robin 3 questions"],
        ["E23",1005,"One man's meat is one girl's poison.","Lose to a Girtabilu"],
        ["E24",1006,"Sting Operation","Succumb to a Girtabilu's poison twice"],
        ["E25",1007,"Golden Girl","Wish for gold in the Genie Lamp"],
        ["E26",1008,"Back to Reality","Wish to return to the real world in the Genie Lamp"],
        ["E27",1009,"Wish Granted","See ending entry for details"],
        ["E28",1010,"Fallen Warrior","Lose to a Lizardwoman"],
        ["E29",1011,"Hot and Unbothered","Use the hot spring five times"],
        ["E30",1012,"Friends Forever, Stick Together","Interact with the red slime too much"],
        ["E31",1013,"Heart of the Cards","Lose to the Duelist and win the card duel against Robin"],
        ["E32",1014,"Fatal Fate","Step on a wrong tile in the Trial of Night"],
        ["E33",1015,"Boy Toyed With","Lose to the Warden"],
        ["E34",1016,"Stuck in the Sexpot","Lose to the Pot Devil"],
        ["E35",1086,"The Walls have Eyes and Ears","Fail to wash the tar off in the vents"],
        ["E36",1087,"Judge Not, Lest ye be Judged","Fail to convince Fera to leave after having saved the three people"],
        ["E37",1088,"Living Vicariously is still Living","Fail to convince Fera to leave after having saved at least one person"],
        ["E38",1089,"In the Lap of the Gods","Fail to convince Fera to leave after failing to save a single person, choose Anubis"],
        ["E39",1090,"In the Grace of the Gods","Fail to convince Fera to leave after failing to save a single person, choose Humanity"],
        ["E40",1091,"I wanna Melt in your Mouth","Fail to bake the cake with Kim"],
        ["E41",1092,"Cooked to Perfection","Check the oven after freeing Kim and Fera"],
        ["E42",1093,"Dancing for Tips","Lose to Morgan twice"],
        ["E43",1094,"Lover's Martyrdom","Lose to Pharaoh Farinet"],
        ["E44",1095,"Strap on the Feedbag","Lose to Pharaoh Farinet with the headdress and staff broken, interact with the pen"],
        ["E45",1096,"Hunger is the Best Sauce","Lose to Pharaoh Farinet with the headdress and staff broken, go back to your room"],
        ["E46",1097,"Succubus of the Sands","Lose to Pharaoh Farinet with the headdress and staff broken, leave the pyramid"],
        ["E47",1098,"Land of Milk and Honey","Lose in the second battle with the Echidna"],
        ["E48",1099,"Mother's Little Helpers","Read the Relic of Hathor"],
        ["E49",1100,"Can't Teach the Mother to Lay Eggs","Read the Relic of Hathor and attempt to transform Bastet several times"],
        ["E50",1101,"It's a Long Story","Lose to Khepri"],
        ["E51",1121,"Desert Omens","Leave the Desert with Farinet's curse"],
        ["E52",1122,"Puffed up with Pride","Leave the Desert with Bastet's curse"],
        ["F1",1046,"Bottom's Up!","Fail the Feasting Beast QTE and choose \"Follow the warmth\""],
        ["F2",1047,"Can't Make This Stuff Up!","Read the purple book in the Princess's secret lab as Princess Rien, with the mental changes over halfway done."],
        ["F3",1048,"Pretty as a Princess","Fail to escape the Princess's bedroom in time"],
        ["F4",1049,"Hardon My French","Succumb to Obedience as a French Maid"],
        ["F5",1050,"If I Were a Boi","Succumb to Obedience as a Femboy Maid"],
        ["F6",1051,"Cat Needs the Cradle","Succumb to Obedience as a Catgirl Maid"],
        ["F7",1052,"Know Your Place, Elfin Race","Succumb to Obedience as an Elfin Maid"],
        ["F8",1053,"Trading Lives","Lose to the Bandit and the Tanuki Merchant"],
        ["F9",1054,"Taking the Rac","Lose to the Bandit, and successfully steal the necklace"],
        ["F10",1055,"Circle of Life","Lose to a Harpy"],
        ["F11",1125,"The Featherweight Tramp","Lose to the Harpy Matriarch"],
        ["F12",1126,"An Iron Grip","Lose all honour in the dominant path of the Goblin Quest"],
        ["F13",1127,"Big Things Come in Small Packages","Lose all honour in the goblin path of the Goblin Quest"],
        ["F14",1128,"Trojan Whore","Lose all honour in the submissive path of the Goblin Quest"],
        ["F15",1129,"Near and Deer","Lose to Aisai after the Goblin Quest, and \"Stay with the Stag\""],
        ["F16",1130,"Jane Doe","Lose to Aisai after the Goblin Quest, and \"Fight your Fear\""],
        ["F17",1131,"Gud Husbun make Gud Waife","Lose to the Bridge Troll"],
        ["F18",1132,"Royally Fucked","Get caught by Morgan in the Mystic Woods East"],
        ["F19",1133,"It's a Bust","Lose to the Living Statue in Cellini's Workshop"],
        ["F20",1134,"A Rolling Stone Gathers No Moss","Lose to the Living Statue in the Deserted Cliffs"],
        ["F21",1135,"Pillar of the Community","Lose to Cellini's Assistant"],
        ["F22",1136,"Magnum Opus","Lose to Cellini the Sculptor and do not flee"],
        ["F23",1137,"Statuesque","Lose to Cellini the Sculptor and attempt to flee"],
        ["F24",1138,"Love is Stone-Blind","Get petrified by Cellini the Sculptor"],
        ["F25",1139,"A Life in Chains Is No Life At All","Let go of the statue and then use magic on first person, threaten the second, and \"take down\" the third."],
        ["F26",1140,"The 'Short' Lived Princess","Let go of the statue and then use magic on first person and use magic on the second as well."],
        ["F27",1141,"Long Live the Princess","Let go of the statue and then bribe the first person, threaten the second, and \"take down\" the third."],
        ["F28",1142,"Free Rein","Lose to Aisai in the Ranch"],
        ["F29",1143,"Heartstrings","Lose to Reylen"],
        ["F30",1144,"Back Behind the Eight Ball","Lose to Cevia in the Mystic Woods"],
        ["F31",1145,"The Redcap-et Treatment","Trigger multiple fairy traps in the Mystic Woods with The Player wearing the Red or Crimson Beret"],
        ["F32",1146,"Drunk off the Atmosphere","Drink the Gida Wine 4 times in a row, then do not leave the clearing."],
        ["F33",1147,"Temptation Given Flesh","After turning into a satyr, leave the clearing and get caught by cultists."],
        ["F34",1148,"Not Quite the Greatest Of All Time","After turning into a satyr, leave the clearing and escape the cultists."],
        ["F35",1149,"A Maiden's Work is Never Done","Run out of time in the Shrine"],
        ["F36",1150,"The Souless Legion","Lose to Ochimusha Kim"],
        ["F37",1151,"Caution to the Wind","Lose to the Kamaitachi"],
        ["F38",1152,"Thank You for the Donation","Lose to the Kitsune and agree to the final request"],
        ["F39",1153,"Peace of Mind","Lose to the kitsune and refuse the final request"],
        ["F40",1154,"A Future Enshrined","Lose to Otohime Yuuka and gain her respect"],
        ["F41",1155,"Woman of the Waters","Lose to Otohime Yuuka and fail to impress her"],
        ["F42",1156,"Split Ends","Lose to the Kejourou"],
        ["F43",1157,"Bad Hair Day","Climb the hair rope in the main hall of the Tainted Shrine during the Miko Quest with the Comb in the inventory."],
        ["F44",1158,"Bleed 'em Dry","Wield the Red Wagasa outside in the Tainted Shrine during the Miko Quest"],
        ["F45",1159,"Bearing One Another's Burdens","Accept the baby from the Ugume during the Yokai Quest"],
        ["F46",1160,"Down on Your Luck","Lose to the Binbōgami"],
        ["F47",1161,"The Model Wife","Enter the doll shack as a miko"],
        ["F48",1162,"Do I even need to say it?","Use the Carrot at the ranch, and agree to be bred by the Rabbit King"],
        ["F49",1163,"Married Above Her Station","Use the Carrot at the ranch, and refused to be bred by the Rabbit King"],
        ["F50",1164,"Let Them Eat Cake","\"Try for the window\" during the Bakery Quest"],
        ["F51",1165,"A Baker's Trio","Lose to Cevia in the Bakery Quest"],
        ["F52",1166,"Beware the Big Bad Wolf","Lose to the Wolf Brutes in the Courier Quest without wearing the Courier's Cloak"],
        ["F53",1167,"A Wolf in Sheep's Clothing","Lose to the Wolf Brutes in the Courier Quest while wearing the Courier's Cloak"],
        ["F54",1168,"Worth her Weight in Gold","Trade most/all of your memories to the Court of Dawn."],
        ["F55",1169,"Green With Envy, Gold With Wrath","Trade most/all of Kim's memories to the Court of Dawn, and barter memories to retrieve her while having traded most/all of your memories to the court of Dawn yourself. Free the fairy."],
        ["F56",1170,"Flat as a Tack","Trade most/all of Kim's memories to the Court of Dawn, and barter memories to retrieve her while having traded most/all of your memories to the court of Dawn yourself. Ignore the fairy."],
        ["F57",1171,"Stout-Hearted","Trade most/all of Dominic's memories to the Court of Dawn, and barter memories to retrieve him while having traded most/all of your memories to the court of Dawn yourself."],
        ["F58",1172,"A Fairy Made","Trade most/all of your memories to the Court of Twilight, then choose at least three \"correct\" memories"],
        ["F59",1173,"A Fairy, Laid","Trade most/all of your memories to the Court of Twilight, then choose at least three \"ambiguous\" memories"],
        ["F60",1174,"A Fairy's Aide","Trade most/all of your memories to the Court of Twilight, then choose at least three \"fairy\" memories"],
        ["F61",1175,"A Fairy Displayed","Trade most/all of your memories to the Court of Twilight, then choose two of each memory path"],
        ["F62",1176,"Two Can Play at that Game","Trade most/all of Kim's memories to the Court of Twilight, and barter memories to retrieve her while having traded most/all of your memories to the court yourself."],
        ["F63",1177,"Stiff Competition","Trade most/all of Dominic's memories to the Court of Twilight, and barter memories to retrieve him while having traded most/all of your memories to the court yourself."],
        ["F64",1178,"Nest Egg","Get caught by the golden hen in the Court of Twilight"],
        ["F65",1179,"Keep Harping On","Get caught by Queen Mab in the Court of Twilight"],
        ["F66",1180,"Art Appreciation","Trade most/all of your memories to the Court of Dusk"],
        ["F67",1181,"Sidhe's All That","Trade most/all of Kim's memories to the Court of Dusk, and barter memories to retrieve her while having traded most/all of your memories to the court yourself."],
        ["F68",1182,"T-HEEits and HAWss","Trade most/all of Dominic's memories to the Court of Dusk, and barter memories to retrieve him while having traded most/all of your memories to the court yourself."],
        ["F69",1183,"Front Row Seat to the Future","Finish being reformated"],
        ["F70",1184,"Cog in the Machine","Lose to the Hollow PXEs/SECURIXEs"],
        ["F71",1185,"Assimilation, Integration, Degradation","Lose to Queen Titania"],
        ["F72",1186,"A New Elysium","Defeat the party in the Kunoichi Quest or lose twice in a row."],
        ["F73",1187,"Okaerinasai","Get caught by the guards thrice in the first mission of the Kunoichi Quest"],
        ["F74",1188,"Kneel Before Your Rod","Fail the attack in the first mission of the Kunoichi Quest"],
        ["F75",1189,"Hollowed Out","Get caught by the yokai frogs twice in the second mission of the Kunoichi Quest"],
        ["F76",1190,"Running On Empty","Get caught by the husks twice in the second mission of the Kunoichi Quest"],
        ["F77",1191,"A Waste of Breath","Fail the final QTEs in the second mission of the Kunoichi Quest"],
        ["F78",1192,"Taking Your Cut","Get caught by the thugs in the third mission of the Kunoichi Quest"],
        ["F79",1193,"The Art of Ikebana","Enter the dining room in the third mission of the Kunoichi Quest"],
        ["F80",1194,"The Escort's Escort","Help Lady Minaka one too many times in the third mission of the Kunoichi Quest"],
        ["F81",1195,"Kiss the Hand that Feeds You","Attack the lord without having helped Lady Minaka in the third mission of the Kunoichi Quest"],
        ["F82",1196,"A Hungry Belly Has No Ears","Lose to a Centaur Guard"],
        ["F83",1197,"Rearing Up","Lose the Centaur Chief's race twice, and attempt to mate with Kiwi"],
        ["F84",1198,"Bringing Up The Rear","Lose to the Centaur Chief's race twice, and attempt to sympathize with Kiwi"],
        ["F85",1199,"Hometown Honey","Lose to the Centaur Chief's race twice while riding Honey"],
        ["F86",1200,"Experience is the Best Teacher","Lose to the Centaur Chief"],
        ["F87",1201,"Suit Each Other to a T","Lose to the Happy Clowns"],
        ["F88",1202,"Silence is Monochrome","Lose to the Mime"],
        ["F89",1203,"A Magician Never Reveals His Secrets","Enter the magician boxes more than 8 times"],
        ["F90",1204,"Send in the Clowns","Lose to Klutzy the Clown"],
        ["F91",1205,"Paid in Exposure","Lose to Oswald's trio"],
        ["F92",1206,"A Good Marriage Is Like Clockwork",""]
    ];

    var ZONES = [
        ['A', 'Forest Zone'], ['B', 'Coastal Zone'], ['C', 'Demon Zone'],
        ['D', 'Desolate Zone'], ['E', 'Desert Zone'], ['F', 'Mythic Zone']
    ];
    var ZONE_NAME = {};
    ZONES.forEach(function (z) { ZONE_NAME[z[0]] = z[1]; });

    //-------------------------------------------------------------------------
    // Parameters
    //-------------------------------------------------------------------------
    var P = (typeof PluginManager !== 'undefined' && PluginManager.parameters)
        ? PluginManager.parameters('MonlineBadEnds') : {};
    function str(k, d) { return P[k] === undefined || P[k] === '' ? d : P[k]; }
    function bool(k, d) { var v = P[k]; return v === undefined ? d : (v === 'true' || v === true); }

    var CFG = {
        titleCommand: str('Title Command', 'Bad Ends'),
        lockedHints: bool('Show Locked Hints', true),
        persistent: bool('Remember Across Saves', true),
        toast: bool('Show Unlock Toast', true),
        zoneWidth: 260,
        detailLines: 4,
        lockedText: '???????'
    };

    //-------------------------------------------------------------------------
    // Indexes
    //-------------------------------------------------------------------------
    var ENTRIES = ROSTER.map(function (r) {
        return { code: r[0], zone: r[0].charAt(0), sw: r[1], name: r[2], trig: r[3] || '' };
    });
    var BY_CODE = {};
    var BY_SWITCH = {};
    var BY_ZONE = {};
    ENTRIES.forEach(function (e) {
        BY_CODE[e.code] = e;
        BY_SWITCH[e.sw] = e;
        (BY_ZONE[e.zone] = BY_ZONE[e.zone] || []).push(e);
    });
    // keep every zone's list in numeric order
    Object.keys(BY_ZONE).forEach(function (z) {
        BY_ZONE[z].sort(function (a, b) {
            return (+a.code.slice(1)) - (+b.code.slice(1));
        });
    });

    //-------------------------------------------------------------------------
    // The record kept across save files
    //-------------------------------------------------------------------------
    var KEY = 'Monline.BadEnds.seen';
    var record = null;

    function loadRecord() {
        if (record) { return record; }
        record = {};
        if (!CFG.persistent) { return record; }
        try {
            if (window.localStorage) {
                var raw = localStorage.getItem(KEY);
                if (raw) {
                    JSON.parse(raw).forEach(function (c) { record[c] = true; });
                }
            }
        } catch (e) { record = {}; }
        return record;
    }

    function saveRecord() {
        if (!CFG.persistent) { return; }
        try {
            if (window.localStorage) {
                localStorage.setItem(KEY, JSON.stringify(Object.keys(record)));
            }
        } catch (e) { /* storage full or blocked - the list still works in RAM */ }
    }

    //-------------------------------------------------------------------------
    // Public API
    //-------------------------------------------------------------------------
    MonlineBadEnds.CFG = CFG;
    MonlineBadEnds.ZONES = ZONES;
    MonlineBadEnds.entries = ENTRIES;

    MonlineBadEnds.total = function () { return ENTRIES.length; };

    MonlineBadEnds.entry = function (code) { return BY_CODE[code] || null; };

    MonlineBadEnds.entriesIn = function (zone) {
        return zone ? (BY_ZONE[zone] || []) : ENTRIES;
    };

    MonlineBadEnds.isSeen = function (code) {
        var e = BY_CODE[code];
        if (!e) { return false; }
        if (record && record[code]) { return true; }
        return !!(window.$gameSwitches && $gameSwitches.value(e.sw));
    };

    MonlineBadEnds.seenCount = function (zone) {
        var n = 0;
        MonlineBadEnds.entriesIn(zone).forEach(function (e) {
            if (MonlineBadEnds.isSeen(e.code)) { n++; }
        });
        return n;
    };

    MonlineBadEnds.zoneStat = function (zone) {
        return { seen: MonlineBadEnds.seenCount(zone),
                 total: MonlineBadEnds.entriesIn(zone).length };
    };

    MonlineBadEnds.mark = function (code) {
        var e = BY_CODE[code];
        if (!e) { return false; }
        if (window.$gameSwitches) { $gameSwitches.setValue(e.sw, true); }
        return MonlineBadEnds.note(code);
    };

    MonlineBadEnds.unmark = function (code) {
        var e = BY_CODE[code];
        if (!e) { return false; }
        if (window.$gameSwitches) { $gameSwitches.setValue(e.sw, false); }
        loadRecord();
        delete record[code];
        saveRecord();
        return true;
    };

    MonlineBadEnds.reset = function () {
        ENTRIES.forEach(function (e) {
            if (window.$gameSwitches) { $gameSwitches.setValue(e.sw, false); }
        });
        record = {};
        saveRecord();
        return true;
    };

    // Record an ending without touching the switch - used by the switch hook.
    MonlineBadEnds.note = function (code) {
        loadRecord();
        if (record[code]) { return false; }
        record[code] = true;
        saveRecord();
        announce(BY_CODE[code]);
        return true;
    };

    // Fold whatever the current save file has into the record.
    MonlineBadEnds.sync = function () {
        if (!window.$gameSwitches) { return 0; }
        loadRecord();
        var added = 0;
        ENTRIES.forEach(function (e) {
            if (!record[e.code] && $gameSwitches.value(e.sw)) {
                record[e.code] = true;
                added++;
            }
        });
        if (added) { saveRecord(); }
        return added;
    };

    MonlineBadEnds.open = function () {
        if (window.SceneManager && window.Scene_BadEndGallery) {
            SceneManager.push(Scene_BadEndGallery);
            return true;
        }
        return false;
    };

    //-------------------------------------------------------------------------
    // Catch an ending the moment its switch is turned on
    //-------------------------------------------------------------------------
    var _Game_Switches_setValue = Game_Switches.prototype.setValue;
    Game_Switches.prototype.setValue = function (switchId, value) {
        _Game_Switches_setValue.call(this, switchId, value);
        var e = BY_SWITCH[switchId];
        if (e && value) { MonlineBadEnds.note(e.code); }
    };

    //-------------------------------------------------------------------------
    // "New Bad End" toast
    //-------------------------------------------------------------------------
    var pendingToast = null;

    function announce(entry) {
        if (!CFG.toast || !entry) { return; }
        pendingToast = entry;
    }

    function Window_BadEndToast() { this.initialize.apply(this, arguments); }
    Window_BadEndToast.prototype = Object.create(Window_Base.prototype);
    Window_BadEndToast.prototype.constructor = Window_BadEndToast;
    Window_BadEndToast.prototype.initialize = function (entry) {
        var w = Math.min(420, Graphics.boxWidth - 40);
        Window_Base.prototype.initialize.call(this,
            (Graphics.boxWidth - w) / 2, 24, w, this.fittingHeight(2));
        this.opacity = 0;
        this.openness = 0;
        this._life = 150;
        this._entry = entry;
        this.refresh();
    };
    Window_BadEndToast.prototype.refresh = function () {
        var e = this._entry;
        var w = this.contents.width;
        this.contents.clear();
        this.changeTextColor(this.systemColor());
        this.drawText('New Bad End', 0, 0, w, 'center');
        this.resetTextColor();
        this.drawText(e.code + ' - ' + e.name, 0, this.lineHeight(), w, 'center');
    };
    Window_BadEndToast.prototype.update = function () {
        Window_Base.prototype.update.call(this);
        this.openness = Math.min(255, this.openness + 24);
        if (this._life > 0) {
            this._life--;
        } else {
            this.openness -= 24;
            if (this.openness <= 0 && this.parent) { this.parent.removeChild(this); }
        }
    };

    //-------------------------------------------------------------------------
    // Window_BadEndHeader - title, tally, progress gauge
    //-------------------------------------------------------------------------
    function Window_BadEndHeader() { this.initialize.apply(this, arguments); }
    Window_BadEndHeader.prototype = Object.create(Window_Base.prototype);
    Window_BadEndHeader.prototype.constructor = Window_BadEndHeader;

    Window_BadEndHeader.prototype.initialize = function (width) {
        Window_Base.prototype.initialize.call(this, 0, 0, width, this.fittingHeight(2));
        this.refresh();
    };
    Window_BadEndHeader.prototype.refresh = function () {
        var w = this.contents.width;
        var seen = MonlineBadEnds.seenCount();
        var total = MonlineBadEnds.total();
        this.contents.clear();
        this.changeTextColor(this.systemColor());
        this.drawText('Bad End Collection', 0, 0, w - 120);
        this.resetTextColor();
        this.drawText(seen + ' / ' + total, w - 116, 0, 116, 'right');
        this.drawGauge(0, this.lineHeight(), w, total ? seen / total : 0,
                       this.hpGaugeColor1(), this.hpGaugeColor2());
    };
    Window_BadEndHeader.prototype.setZone = function (zone) {
        var w = this.contents.width;
        var st = MonlineBadEnds.zoneStat(zone);
        var seen = MonlineBadEnds.seenCount();
        var total = MonlineBadEnds.total();
        this.contents.clear();
        var label = zone ? ZONE_NAME[zone] : 'Bad End Collection';
        this.changeTextColor(this.systemColor());
        this.drawText(label, 0, 0, w - 180);
        this.resetTextColor();
        this.drawText(st.seen + ' / ' + st.total, w - 176, 0, 80, 'right');
        this.changeTextColor(this.systemColor());
        this.drawText('Total ' + seen + ' / ' + total, w - 92, 0, 92, 'right');
        this.drawGauge(0, this.lineHeight(), w,
                       st.total ? st.seen / st.total : 0,
                       this.hpGaugeColor1(), this.hpGaugeColor2());
    };

    //-------------------------------------------------------------------------
    // Window_BadEndZone - left hand zone list
    //-------------------------------------------------------------------------
    function Window_BadEndZone() { this.initialize.apply(this, arguments); }
    Window_BadEndZone.prototype = Object.create(Window_Command.prototype);
    Window_BadEndZone.prototype.constructor = Window_BadEndZone;

    Window_BadEndZone.prototype.initialize = function (x, y) {
        this._listWindow = null;
        Window_Command.prototype.initialize.call(this, x, y);
    };
    Window_BadEndZone.prototype.windowWidth = function () { return CFG.zoneWidth; };
    Window_BadEndZone.prototype.numVisibleRows = function () { return ZONES.length + 1; };
    Window_BadEndZone.prototype.makeCommandList = function () {
        this.addCommand('All Zones', 'zone', true, '');
        ZONES.forEach(function (z) { this.addCommand(z[1], 'zone', true, z[0]); }, this);
    };
    Window_BadEndZone.prototype.drawItem = function (index) {
        var rect = this.itemRect(index);
        var pad = this.textPadding();
        var x = rect.x + pad;
        var w = rect.width - pad * 2;
        var item = this._list[index];
        var st = MonlineBadEnds.zoneStat(item ? item.ext : '');
        var full = st.total > 0 && st.seen === st.total;
        this.changeTextColor(full ? this.powerUpColor() : this.normalColor());
        this.drawText(item ? item.name : '', x, rect.y, w - 76);
        this.changeTextColor(full ? this.powerUpColor() : this.systemColor());
        this.drawText(st.seen + '/' + st.total, x + w - 72, rect.y, 72, 'right');
        this.resetTextColor();
    };
    Window_BadEndZone.prototype.zone = function () {
        var item = this._list[this.index()];
        return item ? item.ext : '';
    };
    Window_BadEndZone.prototype.processOk = function () {
        Window_Command.prototype.processOk.call(this);
    };

    //-------------------------------------------------------------------------
    // Window_BadEndList - the endings themselves
    //-------------------------------------------------------------------------
    function Window_BadEndList() { this.initialize.apply(this, arguments); }
    Window_BadEndList.prototype = Object.create(Window_Selectable.prototype);
    Window_BadEndList.prototype.constructor = Window_BadEndList;

    Window_BadEndList.prototype.initialize = function (x, y, width, height) {
        this._zone = '';
        this._data = MonlineBadEnds.entriesIn('');
        Window_Selectable.prototype.initialize.call(this, x, y, width, height);
        this.refresh();
        this.select(0);
        this.activate();
    };
    Window_BadEndList.prototype.setZone = function (zone) {
        this._zone = zone || '';
        this._data = MonlineBadEnds.entriesIn(this._zone);
        this.refresh();
        this.select(0);
        // this build's Window_Selectable has setTopRow / resetScroll, no scrollTo
        this.setTopRow(0);
    };
    Window_BadEndList.prototype.zone = function () { return this._zone; };
    Window_BadEndList.prototype.maxItems = function () { return this._data.length; };
    Window_BadEndList.prototype.maxCols = function () { return 1; };
    Window_BadEndList.prototype.itemHeight = function () { return this.lineHeight(); };
    Window_BadEndList.prototype.spacing = function () { return 0; };
    Window_BadEndList.prototype.item = function () { return this._data[this.index()]; };
    Window_BadEndList.prototype.drawItem = function (index) {
        var e = this._data[index];
        if (!e) { return; }
        var rect = this.itemRect(index);
        var pad = this.textPadding();
        var x = rect.x + pad;
        var w = rect.width - pad * 2;
        var seen = MonlineBadEnds.isSeen(e.code);
        this.changePaintOpacity(seen);
        this.changeTextColor(this.systemColor());
        this.drawText(e.code, x, rect.y, 44);
        this.changeTextColor(seen ? this.normalColor() : this.systemColor());
        this.drawText(seen ? e.name : CFG.lockedText, x + 48, rect.y, w - 48);
        this.resetTextColor();
        this.changePaintOpacity(true);
    };
    // left / right jump a whole zone, the way a catalogue should scroll
    Window_BadEndList.prototype.cursorRight = function () {
        if (this._zoneWindow) { this._zoneWindow.cursorDown(); }
    };
    Window_BadEndList.prototype.cursorLeft = function () {
        if (this._zoneWindow) { this._zoneWindow.cursorUp(); }
    };

    //-------------------------------------------------------------------------
    // Window_BadEndDetail - the bottom pane
    //-------------------------------------------------------------------------
    function Window_BadEndDetail() { this.initialize.apply(this, arguments); }
    Window_BadEndDetail.prototype = Object.create(Window_Base.prototype);
    Window_BadEndDetail.prototype.constructor = Window_BadEndDetail;

    Window_BadEndDetail.prototype.initialize = function (x, y, width) {
        Window_Base.prototype.initialize.call(this, x, y, width,
            this.fittingHeight(CFG.detailLines));
        this._entry = null;
        this.refresh();
    };
    Window_BadEndDetail.prototype.setEntry = function (entry) {
        if (this._entry === entry) { return; }
        this._entry = entry;
        this.refresh();
    };
    Window_BadEndDetail.prototype.refresh = function () {
        var w = this.contents.width;
        var lh = this.lineHeight();
        this.contents.clear();
        var e = this._entry;
        if (!e) { return; }
        var seen = MonlineBadEnds.isSeen(e.code);

        this.changeTextColor(this.systemColor());
        this.drawText(e.code, 0, 0, 60);
        this.changeTextColor(seen ? this.normalColor() : this.systemColor());
        this.drawText(seen ? e.name : CFG.lockedText, 64, 0, w - 64 - 120);
        this.changeTextColor(seen ? this.powerUpColor() : this.systemColor());
        this.drawText(seen ? 'Found' : 'Not found', w - 116, 0, 116, 'right');
        this.resetTextColor();

        if (!e.trig) { return; }
        if (!seen && !CFG.lockedHints) {
            this.changeTextColor(this.systemColor());
            this.drawText('Discover this ending to read its entry.', 0, lh, w);
            this.resetTextColor();
            return;
        }
        // drawTextEx returns the finishing x in this build, so wrap by hand
        var state = { text: e.trig, index: 0, x: 0, y: lh, left: w };
        state.height = this.calcTextHeight(state, true);
        this.resetFontSettings();
        state.index = 0;
        this.drawTextEx(e.trig, 0, lh, w);
    };

    //-------------------------------------------------------------------------
    // Scene_BadEndGallery
    //-------------------------------------------------------------------------
    function Scene_BadEndGallery() { this.initialize.apply(this, arguments); }
    Scene_BadEndGallery.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_BadEndGallery.prototype.constructor = Scene_BadEndGallery;
    window.Scene_BadEndGallery = Scene_BadEndGallery;

    Scene_BadEndGallery.prototype.create = function () {
        Scene_MenuBase.prototype.create.call(this);
        MonlineBadEnds.sync();
        this.createHeaderWindow();
        this.createZoneWindow();
        this.createDetailWindow();
        this.createListWindow();
    };

    Scene_BadEndGallery.prototype.createHeaderWindow = function () {
        this._headerWindow = new Window_BadEndHeader(Graphics.boxWidth);
        this.addWindow(this._headerWindow);
    };

    Scene_BadEndGallery.prototype.createZoneWindow = function () {
        this._zoneWindow = new Window_BadEndZone(0, this._headerWindow.height);
        this._zoneWindow.setHandler('ok', this.onZoneOk.bind(this));
        this._zoneWindow.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._zoneWindow);
    };

    Scene_BadEndGallery.prototype.createDetailWindow = function () {
        var h = this.fittingHeightH(CFG.detailLines);
        var w = Graphics.boxWidth;
        this._detailWindow = new Window_BadEndDetail(
            0, Graphics.boxHeight - h, w);
        this.addWindow(this._detailWindow);
    };

    Scene_BadEndGallery.prototype.createListWindow = function () {
        var top = this._headerWindow.height;
        var bottom = this._detailWindow ? this._detailWindow.y
                                        : Graphics.boxHeight;
        var x = this._zoneWindow.width;
        this._listWindow = new Window_BadEndList(
            x, top, Graphics.boxWidth - x, bottom - top);
        this._listWindow._zoneWindow = this._zoneWindow;
        this._listWindow.setHandler('cancel', this.popScene.bind(this));
        this._listWindow.setHandler('ok', this.onListOk.bind(this));
        this._zoneWindow._listWindow = this._listWindow;
        this.addWindow(this._listWindow);
        this.onListSelect();
    };

    Scene_BadEndGallery.prototype.fittingHeightH = function (lines) {
        // Window_Base#fittingHeight without having to build a window first
        return lines * 36 + 18 * 2;
    };

    Scene_BadEndGallery.prototype.start = function () {
        // Scene_MenuBase already ran in create(); just focus the list.
        this._listWindow.activate();
    };

    Scene_BadEndGallery.prototype.onZoneOk = function () {
        var zone = this._zoneWindow.zone();
        this._listWindow.setZone(zone);
        this._listWindow.activate();
        this._listWindow.select(0);
        this._headerWindow.setZone(zone);
        this.onListSelect();
    };

    Scene_BadEndGallery.prototype.onListOk = function () {
        // Nothing to open - a bad end has no picture to show.  Toggle the
        // found flag instead so the list can be corrected by hand.
        var e = this._listWindow.item();
        if (!e) { return; }
        if (MonlineBadEnds.isSeen(e.code)) { MonlineBadEnds.unmark(e.code); }
        else { MonlineBadEnds.mark(e.code); }
        this._listWindow.refresh();
        this._zoneWindow.refresh();
        this._headerWindow.setZone(this._listWindow.zone());
        this.onListSelect();
    };

    Scene_BadEndGallery.prototype.onListSelect = function () {
        this._detailWindow.setEntry(this._listWindow.item());
    };

    Scene_BadEndGallery.prototype.update = function () {
        Scene_MenuBase.prototype.update.call(this);
        if (this._listWindow && this._listWindow.active) {
            var i = this._listWindow.index();
            if (i !== this._lastIndex) {
                this._lastIndex = i;
                this.onListSelect();
            }
        }
    };

    //-------------------------------------------------------------------------
    // Title screen - 0091.rb:96 :achieve
    //-------------------------------------------------------------------------
    function picturecheck() { MonlineBadEnds.sync(); return true; }
    window.picturecheck = picturecheck;
    window.Scene_Picture_Gallery = Scene_BadEndGallery;

    if (CFG.titleCommand) {
        var _titleMakeCommandList = Window_TitleCommand.prototype.makeCommandList;
        Window_TitleCommand.prototype.makeCommandList = function () {
            _titleMakeCommandList.call(this);
            // Same guard as MonlineCheatCodes: MV refreshes the command list
            // more than once before the window exists, so a once-flag would
            // silently drop the entry.
            var list = this._list;
            var at = list.length;
            for (var i = 0; i < list.length; i++) {
                if (list[i].symbol === 'achieve') { return; }
                if (list[i].symbol === 'options') { at = i; }
            }
            list.splice(at, 0, {
                name: CFG.titleCommand, symbol: 'achieve',
                enabled: true, ext: null
            });
        };

        var _titleCreateCommandWindow = Scene_Title.prototype.createCommandWindow;
        Scene_Title.prototype.createCommandWindow = function () {
            _titleCreateCommandWindow.call(this);
            this._commandWindow.setHandler('achieve',
                this.commandAchieve.bind(this));
        };

        Scene_Title.prototype.commandAchieve = function () {
            this._commandWindow.close();
            picturecheck();
            SceneManager.push(Scene_BadEndGallery);
        };
    }

    //-------------------------------------------------------------------------
    // Plugin commands
    //-------------------------------------------------------------------------
    var _Game_Interpreter_pluginCommand =
        Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        var handled = true;
        if (command === 'BadEnds' || command === 'BADENDS') {
            var a1 = (args[0] || '').toLowerCase();
            if (a1 === 'open') {
                MonlineBadEnds.open();
            } else if (a1 === 'mark' && args[1]) {
                MonlineBadEnds.mark(args[1].toUpperCase());
            } else if (a1 === 'unmark' && args[1]) {
                MonlineBadEnds.unmark(args[1].toUpperCase());
            } else if (a1 === 'reset') {
                MonlineBadEnds.reset();
            } else if (a1 === 'count') {
                var vid = +args[1] || 0;
                if (vid > 0 && window.$gameVariables) {
                    $gameVariables.setValue(vid, MonlineBadEnds.seenCount());
                }
            } else { handled = false; }
        } else { handled = false; }
        if (!handled) {
            _Game_Interpreter_pluginCommand.call(this, command, args);
        }
    };

    //-------------------------------------------------------------------------
    // Toast on the map
    //-------------------------------------------------------------------------
    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);
        if (pendingToast && !this._badEndToast) {
            var w = new Window_BadEndToast(pendingToast);
            pendingToast = null;
            this._badEndToast = w;
            this.addWindow(w);
        }
        if (this._badEndToast && (this._badEndToast._life <= 0 || !this._badEndToast.parent)) {
            this._badEndToast = null;
        }
    };

    //-------------------------------------------------------------------------
    // Ruby-facing names, so event scripts can use them too
    //-------------------------------------------------------------------------
    if (window.MonlineRuby && MonlineRuby.F) {
        MonlineRuby.F.bad_ends_seen = function () { return MonlineBadEnds.seenCount(); };
        MonlineRuby.F.bad_ends_total = function () { return MonlineBadEnds.total(); };
        MonlineRuby.F.bad_end_seen = function (c) { return MonlineBadEnds.isSeen(c); };
        MonlineRuby.F.bad_end_mark = function (c) { return MonlineBadEnds.mark(c); };
        MonlineRuby.F.open_bad_ends = function () { return MonlineBadEnds.open(); };
    }

    console.log('[MonlineBadEnds] loaded - ' + ENTRIES.length + ' endings');
})();
