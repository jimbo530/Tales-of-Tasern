// ============================================================
// intro.ts — Opening story text for Tales of Tasern
// Shown to new players when they start the game.
// ============================================================

export const INTRO_PARAGRAPHS = [
  `The port town of Kardov's Gate crouched against the rocky curve of a wind-lashed bay, its walls black with centuries of salt and smoke. High ramparts of weathered basalt rose above the crashing surf, crowned with watchtowers whose iron braziers never went dark. The scent of tar, brine, and woodsmoke rolled in heavy waves through the narrow streets, where sailors from every corner of the known world jostled with cloaked merchants and sharp-eyed sellswords. At the harbor's mouth, a massive sea chain\u2014thick as a man's thigh\u2014could be drawn across the water to choke off unwanted vessels, and above it loomed the Iron Maw\u2014a twin-towered fortress whose great ballistae kept watch over friend and foe alike. Even in daylight, Kardov's Gate wore the wary air of a place that expected trouble\u2026 and profited from it.`,

  `Beyond the sea-stink of the docks, the cobbled lanes wound upward into the Artisans' District, where the clang of hammer on anvil and the hiss of hot tongs in water rang like the heartbeat of Kardov's Gate. Here, bright awnings shielded jewelers' stalls, glassblowers worked their furnaces, and the air shimmered with the mingled perfumes of dyes, incense, and molten metal. At the district's central fountain, a town crier in a red-and-gold tabard mounted a weathered plinth, his bell cutting through the din. "Hear ye! Hear ye!" he bellowed, voice carrying down the bustling street. "By decree of the Alchemists' Guild, stout-hearted souls are sought to brave the Blackwood Ruins and retrieve the Vessel of Namaris, an artifact of great and perilous power! Generous reward to those who return it whole\u2014double for those who survive the journey!" Murmurs rippled through the crowd, some faces pale with superstition, others lit with the gleam of opportunity.`,

  `The crier's words spread through the Artisans' District like sparks on dry straw. Merchants leaned over counters to whisper to customers, apprentices abandoned their workbenches to crane for a better view, and dice games in shadowed tavern doorways paused mid-throw. Down the hill, two young paladins-in-training\u2014mail shirts still shining from morning drills\u2014caught the tail end of the proclamation while patrolling the outer market. They exchanged glances, half-competitive grins tugging at their faces, and began to argue in low voices over who might have the skill or the luck to claim the Vessel of Namaris. By the time they passed beneath the rose-and-gold spires of the Temple of Dawn, the news had already outpaced them, carried by swift-tongued hawkers and errand boys. Within the hour, the relic's name was on every tongue: in the candlelit kitchens where novices kneaded bread, in the cloisters where priests recited their evening prayers, and even in the high sanctum where the High Luminar himself paused mid-sermon, his voice trailing off into thoughtful silence.`,

  `Not all ears that caught wind of the crier's call wore the gilded sigils of the Dawn. In the twisting arteries of Kardov's Gate's underbelly, where torchlight never quite reached and the cobbles were slick with last night's rain, ragged street urchins darted like shadows between crates and barrels. For a copper coin or a crust of bread, they carried the tale into the gloom\u2014past shuttered windows, through trapdoors in false walls, and down into the cellars where the real conversations happened. There, thieves lounged in the smoke-hazed back rooms of taverns with no names, their eyes narrowing at the mention of an "artifact of great and perilous power." Rogues, cutpurses, and smugglers passed the rumor along over clinking tankards, their murmurs weaving together in a tapestry of greed and speculation. By midnight, the Vessel of Namaris had become a promise of untold wealth\u2026 or an invitation to die in the wilds, depending on who was listening.`,

  `By dawn the next day, Kardov's Gate was a city in motion. Smithies rang from sunup as armor was mended and blades honed; alchemists stocked travel satchels with vials that hissed and smoked; stablehands tightened straps on restless horses, their breath steaming in the chill morning air. In the markets, fur-cloaked hunters bargained for maps of the Blackwood, while mercenary captains posted notices promising strength in numbers\u2014at a price. Even the harbor bustled with crews provisioning ships "just in case" the relic lay somewhere further afield than the crier claimed. From the gilded halls of the Temple of Dawn to the dripping vaults of the thieves' dens, hearts beat with the same mingled thrill and dread. And now, dear traveler, the question turns to you: who will step forward from this city's throng to seek the Vessel of Namaris? Tell their name, their trade, their reason for risking the wilds\u2014and the streets of Kardov's Gate will remember.`,
];

// HIDDEN KNOWLEDGE (discoverable via high Diplomacy/Gather Info on farm tiles):
//   - Many farmers and villagers don't believe the Vessel is real.
//   - They think it's a ruse to lure adventurers to the island.
//   - They don't talk about it openly because it's GOOD for the economy —
//     adventurers spend gold, claim new lands to the west, and bring trade.
//   - This is a secret the common folk share among themselves but won't
//     volunteer to outsiders unless you earn their trust.
//
// Key lore established by the intro:
//
// LANDMARKS:
//   - Iron Maw: twin-towered fortress at harbor mouth, great ballistae
//   - Sea Chain: massive chain across harbor mouth to block ships
//   - Central Fountain: in Artisans' District, town crier's plinth
//   - Temple of Dawn (Dawnfire): rose-and-gold spires, High Luminar leads
//
// DISTRICTS (referenced):
//   - Docks / Harbor: tar, brine, sailors, the sea chain
//   - Artisans' District: smiths, jewelers, glassblowers, market stalls
//   - Temple District: Temple of Dawn with its cloisters and sanctum
//   - Underbelly: thieves' taverns, trapdoors, false walls, cellars
//
// STARTING QUEST:
//   - "Vessel of Namaris" — Alchemist Guild quest
//   - Location: Blackwood Ruins
//   - Reward: generous, double if you survive
//   - Known across ALL factions — everyone wants it
//
// CHARACTERS MENTIONED:
//   - Town Crier: red-and-gold tabard, at central fountain
//   - High Luminar: leader of Temple of Dawn(fire)
//   - Two young paladins-in-training: patrol outer market
//   - Street urchins: carry news to the underbelly
