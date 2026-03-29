// ─── All Game NFT Characters ──────────────────────────────────────────────────
// Each entry is name + contract address on Base, token ID is always 1.
// LP pairs are discovered dynamically — no need to hardcode per character.
export type GameNft = {
  name: string;
  contractAddress: `0x${string}`;
  chain: "base" | "polygon";
};

export const GAME_NFTS: GameNft[] = [
  { name: "Tales of Tasern Character", contractAddress: "0x9de88faa0dbcfc75534d1b4fd277dadffcc4fd30", chain: "base" },
  { name: "Dreadmane Ravager",          contractAddress: "0xfaf9a6b6409b3e69f7d3b38099b41c45bbc29ba5", chain: "base" },
  { name: "Future Funders",             contractAddress: "0xEE67c60d0E9687BB6D4cA2D90357FC8155F3c2c8", chain: "polygon" },
  { name: "Future Funder",              contractAddress: "0xE2E9C314E1AD0764b6ef22B6408674a33F84FD41", chain: "polygon" },
  { name: "Future Funder Archibald",    contractAddress: "0x67052bFEB30203A7bEEEAD76b58f51B931Ff4d1C", chain: "polygon" },
  { name: "NFTree Mangrove",            contractAddress: "0xE93889FC55B4c95227A0499d175890d001410D17", chain: "polygon" },
  { name: "Future Funder Ambrose",      contractAddress: "0x5B5A2bcfd8b19814bCB6BE9091a892FF0ceB23c6", chain: "polygon" },
  { name: "NFTree Glowing Mangrove",    contractAddress: "0x11Bc51A6726A588D65ED7087E5F4eD853EC0F390", chain: "polygon" },
  { name: "ReGen Generator",            contractAddress: "0xB22bf25A33a539e769CEb48cad5E2C0951bEfb21", chain: "polygon" },
  { name: "Earth Farm",                 contractAddress: "0x4717ef81F44Ff2cd3fd7C51299595f1daD682631", chain: "polygon" },
  { name: "Blue Rose",                  contractAddress: "0x78cD29b5095D74d1AB90AC74023F5ecC9e41Cc87", chain: "polygon" },
  { name: "Sky Ship Aurora",            contractAddress: "0x153Ec2E5DA59370c05Db0826a6489ebd348fe471", chain: "polygon" },
  { name: "Sky Ship Zephyr",            contractAddress: "0x9a1e5D7D2D68B6BA35958Dbb9d8db1090c1C6401", chain: "polygon" },
  { name: "Coral Cavern",               contractAddress: "0x46faf62987F9C270f93f1918Bf1c6de02De7010f", chain: "polygon" },
  { name: "Red Rose",                   contractAddress: "0xA4A12DEA67D09ec7FF89e8E9B0d71857D796180B", chain: "polygon" },
  { name: "Beatrice",                   contractAddress: "0x546C259e374640FA6A1bf39a845c7F829a46b5Fa", chain: "polygon" },
  { name: "Malcolm",                    contractAddress: "0xA68F8d50edDCD01BDA6849D499Db50090c3695a7", chain: "polygon" },
  { name: "Yellow Rose",                contractAddress: "0xEF5ABF519703Ee8830666448DE49cd35953a5a0C", chain: "polygon" },
  { name: "Daniel",                     contractAddress: "0x69aAeC5B4A41847F6476965Cefa4f6C11771522a", chain: "polygon" },
  { name: "Rainbow Rose",               contractAddress: "0xB270D4c1E547476DcEEBC4FE5E4FFFA9f3b7F3EB", chain: "polygon" },
  { name: "Paradise City",              contractAddress: "0xe43e7CFFE752Af93CEeE176A1Fcf66d0b344b3d0", chain: "polygon" },
  { name: "Purple Rose",                contractAddress: "0x8336D3Dd46dFF37E6f0CffE2160890F4F20611b9", chain: "polygon" },
  { name: "Orange Rose",                contractAddress: "0x5E2191BE7468D66c533Cc1B00aA4a90B01487820", chain: "polygon" },
  { name: "Amethysts Rose",             contractAddress: "0x7cc39D39C5e68a051B2361876b25E7E116901e59", chain: "polygon" },
  { name: "Amber Rose",                 contractAddress: "0x52c1870248D8dbA81B9471aD4124bbd3C6D77eE4", chain: "polygon" },
  { name: "Earth Orchard",              contractAddress: "0x5930D364ccC1089eB300aCE643bB439f5780239A", chain: "polygon" },
  { name: "White Rose",                 contractAddress: "0x777a26742faA4Ff5D60408589eF0082dE50c6c13", chain: "polygon" },
  { name: "Thistlebeard",               contractAddress: "0x98ACF6F032E254BE6F9D46407077F9e7e896Db7b", chain: "polygon" },
  { name: "Granite Thornefoot",         contractAddress: "0x20876b539Df03415c9c11B8B35D371FbaC7e03dD", chain: "polygon" },
  { name: "Pippin Thistledown",         contractAddress: "0xae195DF237739D6d43d4B796553f594C5ba516a7", chain: "polygon" },
  { name: "Eldric Greenleaf",           contractAddress: "0x6271989f518Ea0010dd478665ED9547E226DB7E8", chain: "polygon" },
  { name: "Dag",                        contractAddress: "0x2685Bb66e8e45e386D3E816726De64d5001317fd", chain: "polygon" },
  { name: "High Queen Elara",           contractAddress: "0xEE822258BB450ae1109b627Fdd0647963C602c92", chain: "polygon" },
  { name: "High King Thoradin",         contractAddress: "0xc4a80ac34e9c36F3E63c354f053234c5E3f65EAe", chain: "polygon" },
  { name: "Wolverine Stormrunner",      contractAddress: "0xbF50dD7eEACB02838085085De26C17c598F14d03", chain: "polygon" },
  { name: "Reginald Featherstone",      contractAddress: "0xad56aF3Fc6d06A6DC50BfF752c485c2481CDcb93", chain: "polygon" },
  { name: "Zogthar",                    contractAddress: "0x749AB1afa0cAaCb6f8b8E75F87cB79a97E43315B", chain: "polygon" },
  { name: "Amanthar",                   contractAddress: "0xE0D994881f5cf5Af0Dd855778AEF710fCF3348ae", chain: "polygon" },
  { name: "Farlok",                     contractAddress: "0x8003e3d06309c6D332A7eD2a62285cb06cb5f08d", chain: "polygon" },
  { name: "Tharok",                     contractAddress: "0xB2C386Cc2cfe12e2733B4b8bb0cCCc60f49750A8", chain: "polygon" },
  { name: "Glow Lily",                  contractAddress: "0xCD01FF3898fBe6181A3aBE4792641D5aDa4172D1", chain: "polygon" },
  { name: "Orange Glow Lily",           contractAddress: "0xA7BA1Ad556C99f44063Cee92A376c3fC5F3f1e65", chain: "polygon" },
  { name: "Rainbow Lily",               contractAddress: "0x6AD5621f5719A6b32d0Ea9dd4493ca6Ac0639D4B", chain: "polygon" },
  { name: "Ghost Lily",                 contractAddress: "0x00B48394ce2ADc0E569e0081B229b4C2b056f1E5", chain: "polygon" },
  { name: "Jungle Lily",                contractAddress: "0xb75CD04c222F5eb34154CbECB7A202a835975Aca", chain: "polygon" },
  { name: "Purple Lily",                contractAddress: "0x77f9B989961ED88B652d673e6f929d1b500bDAb7", chain: "polygon" },
  { name: "Night Lily",                 contractAddress: "0x7e35F3a6F996de05D349863C4D77DfaeC6A130eD", chain: "polygon" },
  { name: "Galaxy Lily",                contractAddress: "0xE6194b9C8ed2e1D778d14A425904AB7C2cf40460", chain: "polygon" },
  { name: "Clucky",                     contractAddress: "0xF83Df02D4cbc3429720dBC863173586bb4dD56a4", chain: "polygon" },
  { name: "Phantom Lily",               contractAddress: "0x663aa04F7e24Ead9b125B62f535224abB94ceB82", chain: "polygon" },
  { name: "Lily White",                 contractAddress: "0x8D2F638366Ae2fd1A73d7970AFcb587CF6EC5860", chain: "polygon" },
  { name: "Orcala",                     contractAddress: "0x5fba5ADf77EE9eA40D43C97C12A72dEE3a0B0FBA", chain: "polygon" },
  { name: "Korak",                      contractAddress: "0x22ffB7ef5772B702071cF77238bfe2138BB4262E", chain: "polygon" },
  { name: "Thalindor",                  contractAddress: "0x65bcb623C4d9EA9A5Bdea8984ce857d117BE1606", chain: "polygon" },
  { name: "Glowing Geranium",           contractAddress: "0x212626D66E64C9C293A845687dB700c16466586e", chain: "polygon" },
  { name: "Gemstone Geranium",          contractAddress: "0x42CE5e89D0D5f841E668E63310b96ABE159f5761", chain: "polygon" },
  { name: "Blue Lotus",                 contractAddress: "0xeAbd6287311398725eec6E226BdDc29cAFeDb2c9", chain: "polygon" },
  { name: "Red Lotus",                  contractAddress: "0x78B6491192a0A893F7F0a6b07E2a8eaDA6Bca145", chain: "polygon" },
  { name: "Orange Lotus",               contractAddress: "0x95D62C3fD683Cdd602B8a21409A3DC14fb7095A9", chain: "polygon" },
  { name: "White Lotus",                contractAddress: "0xBfbdF914d0DA67210d7a002ebfFe885796E7982f", chain: "polygon" },
  { name: "Pink Lotus",                 contractAddress: "0x4C611EC59F25A32628f6a1688e16700e3dF85532", chain: "polygon" },
  { name: "Rainbow Lotus",              contractAddress: "0xaB3DB7E39288deceE3FCc420874e9e903b2Be02b", chain: "polygon" },
  { name: "Sporewind",                  contractAddress: "0x86495C3799D00E7Dfa00bD0E1ad988Dd602555e7", chain: "polygon" },
  { name: "Mycelis",                    contractAddress: "0xB701E3EbB931927C83E91b1d81B6B53AE6FCff92", chain: "polygon" },
  { name: "Blue Butterfly",             contractAddress: "0x2c8f62442641f5A17B8C014667FcB085471d47b6", chain: "polygon" },
  { name: "Electric Bird",              contractAddress: "0x7F55796f79352Ab707e7FC41dD0B317Be6CBd165", chain: "polygon" },
  { name: "Lady of the Forest",         contractAddress: "0x05D439e519ea23c7b2Fcf5C5aA1bE20FC3a9a5c4", chain: "polygon" },
  { name: "Blue Haven",                 contractAddress: "0xbE175333eC2276Da1550EAb96d1BE48D01433Fd4", chain: "polygon" },
  { name: "Zombie Rex",                 contractAddress: "0x647972EB458401022c4e57263Eea82bCb7eA08c8", chain: "polygon" },
  { name: "Dr. Sprocket",               contractAddress: "0xb9b238b331cc091cE55771ab6A7916c1eD67aB7a", chain: "polygon" },
  { name: "Electric Frog",              contractAddress: "0x6C5dd85c43DCcA2DEc1dE696917C9AF8E331428B", chain: "polygon" },
  { name: "Flame Frog",                 contractAddress: "0x59B16E24aEf1878a03de87e7D58bd9C6FF3ed6e4", chain: "polygon" },
  { name: "Black Frog",                 contractAddress: "0xdC1C58A8a05704f69D6984e7640dEE62a2224087", chain: "polygon" },
  { name: "White Frog",                 contractAddress: "0xb71635FB45dC09676a00Bb886f2c63b5690C3F8b", chain: "polygon" },
  { name: "Blue Frog",                  contractAddress: "0x696Be19EDEeE15CaB2Fd2bBb590Ae0dAfEb1D638", chain: "polygon" },
  { name: "Yellow Frog",                contractAddress: "0x223213b59330a60915196Ce375703aa8033d9b5e", chain: "polygon" },
  { name: "Purple Frog",                contractAddress: "0xA3652D94789B99f7358a7A116281D5eaF95D4264", chain: "polygon" },
  { name: "Orange Frog",                contractAddress: "0x88A87886CAD8A41def6100C614B9C8408ECa6A3a", chain: "polygon" },
  { name: "Blue Spotted Frog",          contractAddress: "0x7D49E203Da67eC1Dd12c7f47909C86B4A7E43856", chain: "polygon" },
  { name: "Yellectric Frog",            contractAddress: "0x9CF5CcAe7ca8Ca68BE185121401ec201D9AD02ad", chain: "polygon" },
  { name: "Stanley",                    contractAddress: "0xAb5020c186A5f1Cf37c6EAF132923e013CaC7052", chain: "polygon" },
  { name: "Jimmy Bananas",              contractAddress: "0xe3062d59cEBe33d050C01cc93d12BF4D472D601c", chain: "polygon" },
  { name: "Baxter Malone",              contractAddress: "0xE0CABde2faFA56789869f2ee8A83B53b10FFe32d", chain: "polygon" },
  { name: "Captain Thorne Blackclaw",   contractAddress: "0xFfAaD6598B865C4F51bEeC4fc701356A667BE2B4", chain: "polygon" },
  { name: "Severin Nightshade",         contractAddress: "0xF1e463Cc3e71A0dd3daff89563219da2f61ECA12", chain: "polygon" },
  { name: "Chevelle",                   contractAddress: "0xbD580487B78B5CAF6d223f9c80F7aef73deFF116", chain: "polygon" },
  { name: "Pistachio",                  contractAddress: "0x16a2438ef26B7c4238d11751a809210d449eb3F4", chain: "polygon" },
  { name: "Tonka",                      contractAddress: "0x8b0Ebd0e329C0892AD0F9Dc884E633d8ef7c5C11", chain: "polygon" },
  { name: "Duke",                       contractAddress: "0x4A1f91862C963c757c183211FDD02ae31f53d633", chain: "polygon" },
  { name: "Baxter",                     contractAddress: "0x405132f30ea1339B721613540cCa950D2815F91a", chain: "polygon" },
  { name: "Rockette Diamond",           contractAddress: "0xf541EFF7CB772751b4105b37d30dbA0965f36fCb", chain: "polygon" },
  { name: "Maverick",                   contractAddress: "0x45C8C9f48E4f54116A1b20a5F7a5Ac7F49224e4E", chain: "polygon" },
  { name: "Lady Pergle",                contractAddress: "0x131020282C282B0e401A8012e6a1887faBAf046A", chain: "polygon" },
  { name: "Blue FlaminGROWs",           contractAddress: "0x93172b74e49cc61814D59506661259bdD98e914d", chain: "polygon" },
  { name: "Green FlaminGROW",           contractAddress: "0xE37B68614bdf91e4ea5Bb8aa403927636f09F329", chain: "polygon" },
  { name: "Yellow FlaminGROW",          contractAddress: "0x723d42517d82d952d6D2cc87a8782e1f43c50f3F", chain: "polygon" },
  { name: "Purple FlaminGROW",          contractAddress: "0xf3055149BF9ef147f691Bf70778ba95f459BAd91", chain: "polygon" },
  { name: "Blue Growrilla",             contractAddress: "0x0CaF57Fd28Edda023AC484d1AFBb98694DAe0340", chain: "polygon" },
  { name: "Barksley",                   contractAddress: "0x5dba05A4be689026839C8e62A25474Ef641893e8", chain: "polygon" },
  { name: "Growndolf",                  contractAddress: "0x7Ce47F7d6b6282a5395A0D9128cBC3A72d7fF1B2", chain: "polygon" },
  { name: "Captain Wiskers",            contractAddress: "0x5acDf69A631e55D0711D7492efFd14176706AB0f", chain: "polygon" },
  { name: "Sprout",                     contractAddress: "0x27630A8087abd22be117d8ce39329B77a94FeC86", chain: "polygon" },
  { name: "Emperor Kaldraxar",          contractAddress: "0xFaf5E41c66660Ea3D5441828C40CB4391E0c6f58", chain: "polygon" },
  { name: "Pyroskar The High King",     contractAddress: "0xc6546d0A0fFb10dc71130c737Afc8F87b9F7D446", chain: "polygon" },
  { name: "Thalvorn Stormcaller",       contractAddress: "0x6776057eC5F5406BAF898F5FE2693f80e1CC8026", chain: "polygon" },
  { name: "Velthorion",                 contractAddress: "0x3715cBaA8F952979E76396A959132548441D8137", chain: "polygon" },
  { name: "Gorath Flamebrand",          contractAddress: "0x433ab9c1254eDb3b14681831E49A1B587266425a", chain: "polygon" },
  { name: "Richard Biggins",            contractAddress: "0xDaC66f2Afd755Ca5343C710310a57371b8872BB2", chain: "polygon" },
  { name: "Sutekh",                     contractAddress: "0x30f777a60cCEB9A086e2597c9f60e066A0AAa400", chain: "polygon" },
  { name: "Tag",                        contractAddress: "0x83577f152D2ddca62f7bf52fbd0Bda8752C58A8E", chain: "polygon" },
  { name: "Rev",                        contractAddress: "0x283eec6193B41A3E9C7090D7f72dC74B43425a03", chain: "polygon" },
  { name: "Queen of The Western Marsh", contractAddress: "0xA62efFddeC1fC250Df4bd13D29BD28ed2305EF58", chain: "polygon" },
  { name: "Depths of Grun'zhur",        contractAddress: "0x3ea4dBE46D53c5Ab6C2dCAA91F4defD0df83A406", chain: "polygon" },
  { name: "Aegorin Tidecaller",         contractAddress: "0x54d334771EB79c5252f06F171a771ed293ab402a", chain: "polygon" },
  { name: "Eldra Leafwhisker",          contractAddress: "0x4AEaE9DBaa897254d52f7E401D930173152c00b2", chain: "polygon" },
  { name: "Lyrin Ripplechord",          contractAddress: "0x22BBFFe894395075f3538F1c34a680EA43310E7f", chain: "polygon" },
  { name: "Captain Rocco Blackpaw",     contractAddress: "0x196288dbD3D0BD133110c1Af078d1C64aC88fBB0", chain: "polygon" },
  { name: "Lyriana Sunpetal",           contractAddress: "0x6b7dc341eCf7F95924728d86c02de83Fe28C58d0", chain: "polygon" },
  { name: "Briggum the Green",          contractAddress: "0xdB80E6733dFf19872e217Cc5348560A98aCD97c8", chain: "polygon" },
  { name: "Grommok the Greenback",      contractAddress: "0xBaaf961404185E8fA9625B1D08Acf5Ee27C0Cec0", chain: "polygon" },
  { name: "Arvan Frostclaw",            contractAddress: "0x5F315c100Da02745a8b91b7ae37d24d018644fAc", chain: "polygon" },
  { name: "Gorath the Stonewarden",     contractAddress: "0x03DAe0182FF72D316cfb76c8663E588110655C02", chain: "polygon" },
  { name: "Earthbound Guardians",       contractAddress: "0x0B202f470De6e3D912C0402bB115BcC28757cac6", chain: "polygon" },
  { name: "Gorok Earthsinger",          contractAddress: "0xE1B19863f7D6e6228509c0E9dA5deF9673D09aE4", chain: "polygon" },
  { name: "Seren Valkara",              contractAddress: "0x2918E9C8Af035985E9C41B2e7Df00b93b14e258e", chain: "polygon" },
  { name: "Lady Kaelith",               contractAddress: "0x107b2b448249189c10107Fc4510C5446c7438502", chain: "polygon" },
  { name: "Aelith Sylvara",             contractAddress: "0xaD1399fb96e24BC92C62FB7A7922D04e43a050BE", chain: "polygon" },
  { name: "Seren Valcrest",             contractAddress: "0xd57084e950e2d3D1491B3372db20104eF5320BFC", chain: "polygon" },
  { name: "Kael Draythorne",            contractAddress: "0x7413048f0bdc5883Af178A4a8969628E21C2d8b5", chain: "polygon" },
  { name: "The Verdant Tide",           contractAddress: "0x5f4E1aFD2058F72EbE9aFAA1771eE35fa2A4a9cA", chain: "polygon" },
  { name: "Eirwen Earthshaper Caldas",  contractAddress: "0xD99993EC626460362c4E834AC25753dE61753E70", chain: "polygon" },
  { name: "Kaelith Sylvenna",           contractAddress: "0xF97d50D5c4106d885e26b023a6BD14edE4bd6fE2", chain: "polygon" },
  { name: "Auralith Veilwood",          contractAddress: "0xB5ADE4c61657DF819cd6c3F9E6C4b563Ac0527fa", chain: "polygon" },
  { name: "Aurelion Verdanthe",         contractAddress: "0xe903252a71be20d720937eFF50Bc2b50a49F9B1A", chain: "polygon" },
  { name: "Eryndra Sylvanis",           contractAddress: "0xD95D68aEd4Bddb0d370fE055e93FB9F3697336c3", chain: "polygon" },
  { name: "Princess Seraphina Nightshade", contractAddress: "0xb0BdC6Bd0176B0ADEb1030104Bb96b302e7996ac", chain: "polygon" },
  { name: "Slovan the Sloth",           contractAddress: "0x222E62Eb1A27a379D94e35b1C31C057184a21b4e", chain: "polygon" },
  { name: "Hue Mahn",                   contractAddress: "0x48317e9Ef7974Faad8411E76DacD64f8260604e9", chain: "polygon" },
  { name: "Sylra Galewind",             contractAddress: "0xfb2157F573D276B14A3Fe7ceC9d9DD3ae36e52F1", chain: "polygon" },
  { name: "Grak Stonepath",             contractAddress: "0x28771DB758E35dde9c6A751d03e4D4B6C3695B3E", chain: "polygon" },
  { name: "Kaelthar Emberveil",         contractAddress: "0x72436746738A9db53ABfcDb3A13aD87d4F2835f2", chain: "polygon" },
  { name: "Sskal Blackfin",             contractAddress: "0x085534E1EF35F20105692ef2a4D82278812cb9E6", chain: "polygon" },
  { name: "Solwyn Brightgrove",         contractAddress: "0x5904B2bF40fBB1efd0A9894B226a646108c1e5Fa", chain: "polygon" },
  { name: "Sir Aurex Dawnshield",       contractAddress: "0x50efD46F90Ca797E999eB7B4ab23000bDaA4E170", chain: "polygon" },
  { name: "High Paladin Valtherion",    contractAddress: "0xb8BD77529B20aa9E4409032a38dEC5110f9acCC1", chain: "polygon" },
  { name: "Aeltharion Dawncaller",      contractAddress: "0x178d6338Be7dF2361C1833A2d4E69733afFaa3Ce", chain: "polygon" },
  { name: "Valthar the Radiant",        contractAddress: "0x9F8Bb84434e25545603BAC6E884C714550590c60", chain: "polygon" },
  { name: "Azrik Fireborn",             contractAddress: "0x5cD6bF133725dC586A1900C0b4501A11bFC531aA", chain: "polygon" },
  { name: "Tytharion the Titan of Oaths", contractAddress: "0x1fBa48971cEaa5bBfc2c65a9f9D88B36Ec9Cb7d9", chain: "polygon" },
  { name: "Thorgar Stormshield",        contractAddress: "0xDE146553d0D6b6ba5f709b195Eeeb56BacB6710c", chain: "polygon" },
  { name: "Eldrin Thornveil",           contractAddress: "0x5519Dc531AE13e6edAbb67d80Ba768f0c14111c4", chain: "polygon" },
  { name: "Master Vaelin Sunleaf",      contractAddress: "0xf328506a077693014Aa5a9B05666aC7Cd1830764", chain: "polygon" },
  { name: "Barku Whisperpaw",           contractAddress: "0xed647663E85F7AbA245c8866c8A99d14FE3E4cA2", chain: "polygon" },
  { name: "Pip Whistlebranch",          contractAddress: "0x7Bd6beA23bFef5cF7e5Cbe603D3Ca041a3B022D1", chain: "polygon" },
  { name: "Kuro Okami",                 contractAddress: "0xC3a7Af6261B2AbdD1509255a6bD21862e844055D", chain: "polygon" },
  { name: "Eldrin Thornshade",          contractAddress: "0xED1E6AB56212E4f70fa98A16bF4361404c1c93e9", chain: "polygon" },
  { name: "Zephyra",                    contractAddress: "0xcA469C2d51eA92F6332F2393b59D95EDfBe8E0D2", chain: "polygon" },
  { name: "Guan Wu",                    contractAddress: "0xF02894F3429b1B0b4Aa236ccB3ea7Db791D87632", chain: "polygon" },
  { name: "Nereus Skywave",             contractAddress: "0x2F8bE30995bd6db297110DC27fb43eE2225C0eFA", chain: "polygon" },
  { name: "Kara Wolfclaw",              contractAddress: "0xcdA7dFce126F1bC3B7be032c76277e8d1D130946", chain: "polygon" },
  { name: "Elion Starbrook",            contractAddress: "0xe309739315B3019F205ec92Ce54ecb0dC2638d73", chain: "polygon" },
  { name: "Dark Star",                  contractAddress: "0x14B8b6c9e77C94D3575D56a8D2730A565204b47C", chain: "polygon" },
  { name: "Ocho",                       contractAddress: "0xA321aDC0570448f666C4b40E3BC51a88C3c8d0F3", chain: "polygon" },
  { name: "Whiskerleaf of the Hollow Glen", contractAddress: "0x2BD9E5aBE79D26de40491EeA505065efF38556Fe", chain: "polygon" },
  { name: "Lunareth Hollow",            contractAddress: "0x4bc40edEaeb7f10e3FED20D32BC5065d3336815e", chain: "polygon" },
  { name: "Balladore Thistlepaw",       contractAddress: "0x210286bF1B51199f20E97e32793042223fBC0e6F", chain: "polygon" },
  { name: "Tumblewhisker Janglepaws",   contractAddress: "0x58048399ab2ebF31dc18156351F758ce54bB3F46", chain: "polygon" },
  { name: "Luminous Weald",             contractAddress: "0x8137B9C6a0518D055c2D7832Dea278d7Af4e6D64", chain: "polygon" },
  { name: "Kardov's Gate",              contractAddress: "0xdb8c1A17aeA5219312149002CBA5a823C7ac2A44", chain: "polygon" },
  { name: "Sir Dawnpaw",                contractAddress: "0xa18b55A361c5ea4A3Cd3A00eB6Ba9Beb0E967fA2", chain: "polygon" },
  { name: "Guards of Kardov's Gate",    contractAddress: "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", chain: "polygon" },
  { name: "Kael the Stormmane",         contractAddress: "0xD80a19644911cA88AdEE50b33aa0965BF1EC1375", chain: "polygon" },
  { name: "Cloud Runner",               contractAddress: "0x383aB7C99b6746Cde33040889c3D4bD757ff0787", chain: "polygon" },
  { name: "Seraphin Willowpaw",         contractAddress: "0xfdFE6a2A2d9cF23f457d7Fa5667d5F32bF2f775c", chain: "polygon" },
  { name: "Bunrick",                    contractAddress: "0x63a9c72C90860eaa64A39A31E1A4B00305aA3974", chain: "base" },
  { name: "Space Donkeys",              contractAddress: "0x2953399124F0cBB46d2CbACD8A89cF0599974963", chain: "polygon" },
  { name: "MycoVault",                  contractAddress: "0xcb8c8a116ac3e12d861c1b4bd0d859aceda25d3f", chain: "base" },
  { name: "Vaelrith the Veiled Sovereign", contractAddress: "0x4A35B948F49A169976FCCC96220676692c987A57", chain: "base" },
  { name: "Kira Emberstep",               contractAddress: "0x26CE8466eC418b7D42d8789476642cdFbB5e8aab", chain: "base" },
  { name: "Tharion Rootkeeper",          contractAddress: "0x76D50Fbc46a31aC21855b2b8218F4F642991c25e", chain: "base" },
  { name: "Rook Highbranch",            contractAddress: "0xB9c37Ce29A0966f83B29c905c434905301435D9d", chain: "base" },
  { name: "Captain Blackfeather",      contractAddress: "0x716AdcbEd9Ef58CCf11434Aa7962b0f200A030af", chain: "base" },
  { name: "Yellectric Frog",          contractAddress: "0x9CF5CcAe7ca8Ca68BE185121401ec201D9AD02ad", chain: "polygon" },
  { name: "Mason Ironhorn",          contractAddress: "0x412495cde08733715C2478c6EE00876ABF5e6CE8", chain: "base" },
];

// ─── Known LP Pairs (add more as the game expands) ────────────────────────────
// LP pairs are checked against every NFT contract dynamically per chain.
export const KNOWN_LP_PAIRS = {
  base: [
    "0x74af6fd7f98d4ec868156e7d33c6db81fc222e84", // USDGLO / MfT
    "0x4da71963e031d22c25f2b2682454cae834504eb9", // CHAR / MfT
    "0x36d0c273faca6e90f827bc2e7d232246f9f89fe4", // EGP / MfT   (Uniswap V2 Base)
    "0x9aa2f6cfbd0a075a504e155085ac86f91b438287", // EGP / CHAR  (Uniswap V2 Base)
    "0x52fe32ed5d90c2b24af5a20496f01dc3fc965838", // EGP / WETH  (Uniswap V2 Base)
    "0xa2a61fd7816951a0bcf8c67ea8f153c1ab5de288", // BURGERS / MfT  (Uniswap V2 Base)
    "0x2f9669acb8623e33a0d3f9a3e1806ebe54cd319a", // BURGERS / WETH (Uniswap V2 Base)
    "0x7af66828a7d1041db8b183f1356797788979eaf8", // CHAR / USDC    (Uniswap V2 Base)
    "0xbd0cc3b0aaf91b80c862dbcaf39faa4705ee2d7a", // TGN / MfT      (Uniswap V2 Base)
    "0x2873937bb8985b0b2aafe693742c35f557ff8bff", // TGN / EGP      (Uniswap V2 Base)
    "0x6fbb3c6e531f627496d1c98ec88fb0cb01260926", // TGN / WETH     (Uniswap V2 Base)
    "0xecc664757da0c71ba32dfed527580a26783b6697", // AZOS / MfT     (Uniswap V2 Base)
  ] as `0x${string}`[],
  polygon: [
    // ── JLT-F24 (atk) ───────────────────────────────────────────────────────
    "0x4faf57a632bd809974358a5fff9ae4aec5a51b7d", // JLT / DDD  (Uniswap V2)
    "0x3037e96ec872e8838d3d6ac54604c8e3ab28025d", // JLT / EGP  (Uniswap V2)
    "0x6b9634d579dc21c0f4c188d24f92586d4d8b2fc8", // JLT / OGC  (Uniswap V2)
    "0x89798782318207ba18f8765814cf5f324332d637", // JLT / PKT  (Uniswap V2)
    "0xeb33c513908bffe7c9e66ee1d7725831f6c5ca1f", // JLT / BTN  (Uniswap V2)
    "0x2c1e86d23fcf45d9a719affda25accfc5b1ea1f0", // JLT / DHG  (Uniswap V2)
    "0x52fcbd043b5d7d57164da594043ce86e78b4f42f", // JLT / LGP  (Uniswap V2)
    "0x8971149ee723388a9c18b9758978839bd22b06e0", // JLT / CCC  (Uniswap V2)
    // ── JLT-B23 (mAtk) ──────────────────────────────────────────────────────
    "0xb7106c0f2aff3e41b7e621b1bab4b8f3312815d7", // JLT-B23 / CCC  (Uniswap V2)
    "0xf4b02503debb82f6495be47ea31ad9328fd83ad3", // JLT-B23 / IGS  (Uniswap V2)
    "0x679269e0803eef1b6070e8f5a554d8c773f25b47", // JLT-B23 / LGP  (Uniswap V2)
    // ── LANTERN (fAtk) ──────────────────────────────────────────────────────
    "0x4d75b8b5b42f9f3a220334fbc6cebd6fadde880b", // DDD / LANTERN  (Uniswap V2)
    "0xa12c019a70f791daf6bcdfa6c39ea0d59235b8d3", // LANTERN / EGP  (Uniswap V2)
    "0x6611c3a16e4fd98ab8011ddeb1a28d10a3937b5c", // LANTERN / BTN  (Uniswap V2)
    "0xd8706679391cb892878518198f3092dcaeed51b2", // LANTERN / DHG   (Uniswap V2)
    "0x6cab75d1a63628d1bb04ac49230afafb24ef419c", // LANTERN / REGEN (Uniswap V2)
    // ── JCGWR (atk+def) ─────────────────────────────────────────────────────
    "0x7aadf47b49202b904b0f62e533442b09fcaa2614", // JCGWR / DDD  (Uniswap V2)
    "0xc1800f0f6a8cc65cae7a57940e4abeb0e94bdb9b", // JCGWR / EGP  (Uniswap V2)
    "0x85a57d61efb16e6db2c0b9af3384d80772fae877", // JCGWR / LGP  (Uniswap V2)
    // ── TB01 (def) ──────────────────────────────────────────────────────────
    "0x0cbba81c0094af6911c54ab613fcdf6136d4b498", // TB01 / DDD  (Uniswap V2)
    "0xcc1795662453c1e5ffaf2d88bede931934c47bd3", // TB01 / EGP  (Uniswap V2)
    "0x0cfe901729abd698405ec8d960b9acad4ab3040c", // TB01 / IGS    (Uniswap V2)
    "0x87496bf2405fc1c2fc1a9f4963b8cacad851088e", // TB01 / REGEN  (Uniswap V2)
    // ── PR24 (mDef) ─────────────────────────────────────────────────────────
    "0xa249cc5719da5457b212d9c5f4b1e95c7f597441", // PR24 / DDD  (Uniswap V2)
    "0x9adea4f283589b3fe8d11d390eff59037afde05f", // PR24 / EGP  (Uniswap V2)
    "0xd54bf912ee0e6d5a24ab317bfa562a1b8ccfddec", // PR24 / IGS  (Uniswap V2)
    // ── PR25 (magic) ────────────────────────────────────────────────────────
    "0x4ff6295614884b0f7c3269d5ae486b66c5d8615f", // PR25 / EGP  (Uniswap V2)
    "0x485cbb3fe4cae0eb4efbfb859092be506afc6d18", // PR25 / LGP  (Uniswap V2)
    "0x00501f69afa9613ab155e80b9d433bcb972d6f05", // PR25 / WETH (Uniswap V2)
    // ── CCC (mana) ──────────────────────────────────────────────────────────
    "0x73e6a1630486d0874ec56339327993a3e4684691", // CCC / DDD     (Uniswap V2)
    "0xbcd50f1c7f28bc5712ac03c5a18ff0d46ce6bff5", // CCC / EGP     (Uniswap V2)
    "0x3dd8cb68cbe0eb3e57707a3d1f136ff245d829fd", // CCC / OGC     (Uniswap V2)
    "0xad199d493327f5655b4e2f4a7c4e930a73ad226f", // CCC / PKT     (Uniswap V2)
    "0x2e49bb80e4255cdc32551a718444444d42994032", // CCC / BTN     (Uniswap V2)
    "0xef7a39205c45e4aa8a3d784c96088ea9a6d35596", // CCC / DHG     (Uniswap V2)
    "0xdb916d0e476b6263c9f910e17373574747d4c471", // CCC / LGP     (Uniswap V2)
    "0x7407c7fdcdf3f34ef317ad478c9bae252dc91859", // CCC / NCT     (Uniswap V2)
    "0x149eb42c8bb6644ef28411bede171ad051434412", // CCC / BCT     (Uniswap V2)
    "0xa4817dc7bdfdde18e54e4f0bcfa84d632eefb377", // CCC / USDGLO  (Uniswap V2)
    // ── NCT (mana) ──────────────────────────────────────────────────────────
    "0xDb995F975F1Bfc3B2157495c47E4efB31196B2CA", // NCT / USDC      (SushiSwap)
    "0x9e1E2f7569ff9e9597fdaBcbbb6ADD42f0534bdB", // axlREGEN / NCT  (Uniswap V2)
    "0xfc983c854683b562c6e0f858a15b32698b32ba45", // DDD / NCT        (Uniswap V2)
    "0xb70f13acb3f220b01d891b81a417c4dee79b5235", // NCT / IGS        (Uniswap V2)
    "0x35b02ed94ce217a4aba3546099ee9db1b85bfe3d", // BTN / NCT        (Uniswap V2)
    "0x2da5766f3b789204f0151e401b58a0421249426c", // PKT / NCT        (Uniswap V2)
    // ── BCT (mana) ──────────────────────────────────────────────────────────
    "0x1E67124681b402064CD0ABE8ed1B5c79D2e02f64", // BCT / USDC  (SushiSwap)
    "0x32e228A6086c684F1391C0935cB34C296e0DD9Cb", // BCT / WPOL  (SushiSwap)
    // ── LGP (hp) ────────────────────────────────────────────────────────────
    "0x19F3DF2F5900705E8a6DfeBEC0f02ccd10437C0f", // LGP / UNI    (Uniswap V2)
    "0xDFBd6bFd5875463C33e0c18c1FC43aA22f7B84b5", // LGP / WPOL   (Uniswap V2)
    "0x395106988f425dC4c85b1997b7063cFe38C64278", // USDGLO / LGP (Uniswap V2)
    // ── DHG (hp) ────────────────────────────────────────────────────────────
    "0x17Be99a282559a24E57ED4f7FA436665200F890b", // DHG / CRISP-M (Uniswap V2)
    // ── IGS (hp) ────────────────────────────────────────────────────────────
    "0x61646724babcdeb4f70683a5b7c46d2bde506ee8", // IGS / USDGLO (Uniswap V2)
    "0xc9ec8a430e194295c82d75e5900d22f3ed254268", // IGS / WBTC   (Uniswap V2)
    "0xcd7c7a4843f1a32eb7a1e0e23b2a7430505b5e4e", // LTK / IGS    (Uniswap V2)
    "0x8bc8fefd43e02709020b329ee083ed949475b187", // LTK / CCC    (Uniswap V2)
    "0x8e7bf0585de030cE2e04454728Dfc32240F87865", // AU24T / EGP  (Uniswap V2)
    "0x9ED12034939CC2e9f01060F48c8e3e8B67880575", // Grant Wizard / EGP (Uniswap V2)
    // ── BTN (hp) ────────────────────────────────────────────────────────────
    "0x1395E5CBcA1F9cce3271EAd9cA3F727EA6E78cBa", // BTN / WBTC   (Uniswap V2)
    "0x553b5414C109963C636EfE142C8eB6bA2908f55C", // BTN / WPOL   (Uniswap V2)
    "0xc174118B4e8009F525a0464744d4BFEA30F67D9d", // USDGLO / BTN (Uniswap V2)
    // ── OGC (hp) ────────────────────────────────────────────────────────────
    "0xDB217EE8aeee2f344fEE7a9b53E73cc68f7321f3", // OGC / WBTC  (Uniswap V2)
    "0xFD18f7baA05D19fF953D92bEa53a3D6B70F0B52c", // TB01 / OGC  (Uniswap V2)
    // ── PKT (hp) ────────────────────────────────────────────────────────────
    "0x0fdEF11A0B332B3E723D181c0cB5Cb10eA52d135", // PKT / USDT0  (Uniswap V2)
    "0xCd0bAd3Af02b36725A82128469b03535e0d48F2A", // EGP / PKT    (Uniswap V2)
    // ── EGP (hp) ────────────────────────────────────────────────────────────
    "0xd815d289604bD1109e2F3A9B919d7f3D1f2B99fb", // EGP / WETH   (Uniswap V2)
    "0x19e01FC41c8cC561D47e615F3509cd2e128e259B", // EGP / WPOL   (Uniswap V2)
    "0xEb5b6e6AC30fB8949269a88814925B2639eede4b", // USDGLO / EGP (Uniswap V2)
    // ── REGEN (hp+atk) ──────────────────────────────────────────────────────
    "0x520a3b3faca7ddc8dc8cd3380c8475b67f3c7b8d", // DDD / REGEN  (Uniswap V2)
    // ── NEW: missing game-token pairs ───────────────────────────────────────
    "0x0d0ac298f5f1970c0f48c3084dd2d48a1fd24242", // DDD / LGP    (Uniswap V2)
    "0xa628e29a8f0dfcb974bc387ddb933c5fd019a0b7", // EGP / WBTC   (Uniswap V2)
    "0xcb8ecb17365ad243f64839aea81f40679e0c8c9a", // OGC / USDGLO (Uniswap V2)
    "0xdc12e9f5e9daf92df08e5d781c57bb92d5f110ef", // PKT / WBTC   (Uniswap V2)
    "0x0f8f67f4143485bf3afd76389da9a8c745320da6", // PKT / BTN    (Uniswap V2)
    "0x2be03aca43921852d389c65ae82bb9c2f3069f11", // PKT / USDGLO (Uniswap V2)
    "0x3782611c293e4519a386ff848a0d04827111b225", // DHG / WPOL   (Uniswap V2)
    "0x93064cb5fc83919cf608a699a847b64360180e6e", // CCC / WBTC   (Uniswap V2)
    "0x4316dc9f32110f9bef901347cf7b4cdb463e9cb3", // CCC / WETH   (Uniswap V2)
    "0xc9131f6408e31c8fced33f12a031a1b3e2bea080", // CCC / WPOL   (Uniswap V2)
    // ── DDD (hp) ────────────────────────────────────────────────────────────
    "0xcAe2c5BbC8d6f768cA73CF9Bd84A0C90CC492f43", // DDD / WBTC  (Uniswap V2)
    "0x9C4e724a226a4103DC0a303C902357Bcbc7413AF", // DDD / WPOL  (Uniswap V2)
    "0x7eE2dd0022e3460177B90b8F8fa3b3a76D970FF6", // USDGLO / DDD  (Uniswap V2)
    "0xbA262Af3E1c559246e407C94C91F77Ff334F6a90", // EGP / DDD  (Uniswap V2)
    "0x43c9b0DFdaFF40c38a24850636662394EF42D03F", // PR25 / DDD  (Uniswap V2)
  ] as `0x${string}`[],
};

// ─── Stat Token Addresses ─────────────────────────────────────────────────────
// Each stat is an array — multiple tokens can contribute to the same stat.
// The hook sums all matching token amounts across all LP pairs for each chain.
export const STAT_TOKENS = {
  base: {
    attack: [
      "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3", // USDGLO
      "0x4200000000000000000000000000000000000006", // WETH (Base)
      "0x3595ca37596d5895b70efab592ac315d5b9809b2", // AZOS (stablecoin)
    ] as `0x${string}`[],
    hp:     ["0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3", "0xc1ba76771bbf0dd841347630e57c793f9d5accee", "0x06a05043eb2c1691b19c2c13219db9212269ddc5", "0xd75dfa972c6136f1c594fec1945302f885e1ab29"] as `0x${string}`[], // MfT, EGP(Base), BURGERS, TGN
    magic:  ["0x20b048fa035d5763685d695e66adf62c5d9f5055"] as `0x${string}`[], // CHAR → global multiplier
    magicBoost: [] as `0x${string}`[],
    mAtk:   [] as `0x${string}`[],
    fAtk:   [] as `0x${string}`[],
    def:    [] as `0x${string}`[],
    mDef:   [] as `0x${string}`[],
    mana:   [] as `0x${string}`[],
  },
  polygon: {
    attack: [
      "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3", // USDGLO (same address on Polygon)
      "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6", // WBTC (Polygon)
      "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH (Polygon)
      "0xace15da4edcec83c98b1fc196fc1dc44c5c429ca", // JCGWR (also DEF)
      "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WPOL
    ] as `0x${string}`[],
    mAtk: [
      "0xcdb4574adb7c6643153a65ee1a953afd5a189cef", // JLT-F24 (Renewable Energy Credits → electric attack)
      "0x0b31cc088cd2cd54e2dd161eb5de7b5a3e626c9e", // JLT-B23 (electric attack)
    ] as `0x${string}`[],
    fAtk: [
      "0x8e87497ec9fd80fc102b33837035f76cf17c3020", // LANTERN → fire attack
    ] as `0x${string}`[],
    hp: [
      "0x4bf82cf0d6b2afc87367052b793097153c859d38", // DDD
      "0x64f6f111e9fdb753877f17f399b759de97379170", // EGP
      "0x8a088dceecbcf457762eb7c66f78fff27dc0c04a", // PKT
      "0xccf37622e6b72352e7b410481dd4913563038b7c", // OGC
      "0xd7c584d40216576f1d8651eab8bef9de69497666", // BTN
      "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce", // IGS
      "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a", // DHG
      "0xddc330761761751e005333208889bfe36c6e6760", // LGP
      "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b", // REGEN (1/2 HP, 1/2 ATK)
    ] as `0x${string}`[],
    magic: [
      "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7", // CCC → global multiplier (like CHAR on Base)
      "0xef6ab48ef8dfe984fab0d5c4cd6aff2e54dfda14", // CRISP-M → global multiplier
    ] as `0x${string}`[],
    magicBoost: [
      "0x72e4327f592e9cb09d5730a55d1d68de144af53c", // PR25 → multiplies magic stats only
    ] as `0x${string}`[],
    def: [
      "0xcb2a97776c87433050e0ddf9de0f53ead661dab4", // TB01 → defense
      "0xace15da4edcec83c98b1fc196fc1dc44c5c429ca", // JCGWR (also ATK)
      "0x861f57e96678c6cb586f07dd8d3b0c34ce19dd82", // LTK → armor (litter cleanup)
      "0x146642d83879257ac9ed35074b1c3714b7e8f452", // AU24T → armor (tokenized trees)
    ] as `0x${string}`[],
    mDef: [
      "0xd84415c956f44b2300a2e56c5b898401913e9a29", // PR24 → magical defense
    ] as `0x${string}`[],
    mana: [
      "0xD838290e877E0188a4A44700463419ED96c16107", // NCT
      "0x2F800Db0fdb5223b3C3f354886d907A671414A7f", // BCT
      "0xdb7a2607b71134d0b09c27ca2d77b495e4dbeedb", // Grant Wizard
    ] as `0x${string}`[],
  },
};

// ─── ABIs ─────────────────────────────────────────────────────────────────────
export const V2_PAIR_ABI = [
  { name: "getReserves", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "reserve0", type: "uint112" }, { name: "reserve1", type: "uint112" }, { name: "blockTimestampLast", type: "uint32" }] },
  { name: "token0",      type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "token1",      type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "balanceOf",   type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

export const ERC1155_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }, { name: "id", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "balanceOfBatch", type: "function", stateMutability: "view", inputs: [{ name: "accounts", type: "address[]" }, { name: "ids", type: "uint256[]" }], outputs: [{ name: "", type: "uint256[]" }] },
  { name: "uri",       type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
] as const;

export const ERC721_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "tokenURI",  type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
] as const;
