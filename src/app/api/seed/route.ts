import { supabase } from "@/lib/supabase";
import { GAME_NFTS, KNOWN_LP_PAIRS } from "@/lib/contracts";
import { NextResponse } from "next/server";

// LP pair labels extracted from contracts.ts comments
const LP_LABELS: Record<string, string> = {
  // Base
  "0x74af6fd7f98d4ec868156e7d33c6db81fc222e84": "USDGLO / MfT",
  "0x4da71963e031d22c25f2b2682454cae834504eb9": "CHAR / MfT",
  "0x36d0c273faca6e90f827bc2e7d232246f9f89fe4": "EGP / MfT",
  "0x9aa2f6cfbd0a075a504e155085ac86f91b438287": "EGP / CHAR",
  "0x52fe32ed5d90c2b24af5a20496f01dc3fc965838": "EGP / WETH",
  "0xa2a61fd7816951a0bcf8c67ea8f153c1ab5de288": "BURGERS / MfT",
  "0x2f9669acb8623e33a0d3f9a3e1806ebe54cd319a": "BURGERS / WETH",
  "0x7af66828a7d1041db8b183f1356797788979eaf8": "CHAR / USDC",
  "0xbd0cc3b0aaf91b80c862dbcaf39faa4705ee2d7a": "TGN / MfT",
  "0x2873937bb8985b0b2aafe693742c35f557ff8bff": "TGN / EGP",
  "0x6fbb3c6e531f627496d1c98ec88fb0cb01260926": "TGN / WETH",
  "0xecc664757da0c71ba32dfed527580a26783b6697": "AZOS / MfT",
  // Polygon
  "0x4faf57a632bd809974358a5fff9ae4aec5a51b7d": "JLT / DDD",
  "0x3037e96ec872e8838d3d6ac54604c8e3ab28025d": "JLT / EGP",
  "0x6b9634d579dc21c0f4c188d24f92586d4d8b2fc8": "JLT / OGC",
  "0x89798782318207ba18f8765814cf5f324332d637": "JLT / PKT",
  "0xeb33c513908bffe7c9e66ee1d7725831f6c5ca1f": "JLT / BTN",
  "0x2c1e86d23fcf45d9a719affda25accfc5b1ea1f0": "JLT / DHG",
  "0x52fcbd043b5d7d57164da594043ce86e78b4f42f": "JLT / LGP",
  "0x8971149ee723388a9c18b9758978839bd22b06e0": "JLT / CCC",
  "0xb7106c0f2aff3e41b7e621b1bab4b8f3312815d7": "JLT-B23 / CCC",
  "0xf4b02503debb82f6495be47ea31ad9328fd83ad3": "JLT-B23 / IGS",
  "0x679269e0803eef1b6070e8f5a554d8c773f25b47": "JLT-B23 / LGP",
  "0x4d75b8b5b42f9f3a220334fbc6cebd6fadde880b": "DDD / LANTERN",
  "0xa12c019a70f791daf6bcdfa6c39ea0d59235b8d3": "LANTERN / EGP",
  "0x6611c3a16e4fd98ab8011ddeb1a28d10a3937b5c": "LANTERN / BTN",
  "0xd8706679391cb892878518198f3092dcaeed51b2": "LANTERN / DHG",
  "0x6cab75d1a63628d1bb04ac49230afafb24ef419c": "LANTERN / REGEN",
  "0x7aadf47b49202b904b0f62e533442b09fcaa2614": "JCGWR / DDD",
  "0xc1800f0f6a8cc65cae7a57940e4abeb0e94bdb9b": "JCGWR / EGP",
  "0x85a57d61efb16e6db2c0b9af3384d80772fae877": "JCGWR / LGP",
  "0x0cbba81c0094af6911c54ab613fcdf6136d4b498": "TB01 / DDD",
  "0xcc1795662453c1e5ffaf2d88bede931934c47bd3": "TB01 / EGP",
  "0x0cfe901729abd698405ec8d960b9acad4ab3040c": "TB01 / IGS",
  "0x87496bf2405fc1c2fc1a9f4963b8cacad851088e": "TB01 / REGEN",
  "0xa249cc5719da5457b212d9c5f4b1e95c7f597441": "PR24 / DDD",
  "0x9adea4f283589b3fe8d11d390eff59037afde05f": "PR24 / EGP",
  "0xd54bf912ee0e6d5a24ab317bfa562a1b8ccfddec": "PR24 / IGS",
  "0x4ff6295614884b0f7c3269d5ae486b66c5d8615f": "PR25 / EGP",
  "0x485cbb3fe4cae0eb4efbfb859092be506afc6d18": "PR25 / LGP",
  "0x00501f69afa9613ab155e80b9d433bcb972d6f05": "PR25 / WETH",
  "0x73e6a1630486d0874ec56339327993a3e4684691": "CCC / DDD",
  "0xbcd50f1c7f28bc5712ac03c5a18ff0d46ce6bff5": "CCC / EGP",
  "0x3dd8cb68cbe0eb3e57707a3d1f136ff245d829fd": "CCC / OGC",
  "0xad199d493327f5655b4e2f4a7c4e930a73ad226f": "CCC / PKT",
  "0x2e49bb80e4255cdc32551a718444444d42994032": "CCC / BTN",
  "0xef7a39205c45e4aa8a3d784c96088ea9a6d35596": "CCC / DHG",
  "0xdb916d0e476b6263c9f910e17373574747d4c471": "CCC / LGP",
  "0x7407c7fdcdf3f34ef317ad478c9bae252dc91859": "CCC / NCT",
  "0x149eb42c8bb6644ef28411bede171ad051434412": "CCC / BCT",
  "0xa4817dc7bdfdde18e54e4f0bcfa84d632eefb377": "CCC / USDGLO",
  "0xDb995F975F1Bfc3B2157495c47E4efB31196B2CA": "NCT / USDC",
  "0x9e1E2f7569ff9e9597fdaBcbbb6ADD42f0534bdB": "axlREGEN / NCT",
  "0xfc983c854683b562c6e0f858a15b32698b32ba45": "DDD / NCT",
  "0xb70f13acb3f220b01d891b81a417c4dee79b5235": "NCT / IGS",
  "0x35b02ed94ce217a4aba3546099ee9db1b85bfe3d": "BTN / NCT",
  "0x2da5766f3b789204f0151e401b58a0421249426c": "PKT / NCT",
  "0x1E67124681b402064CD0ABE8ed1B5c79D2e02f64": "BCT / USDC",
  "0x32e228A6086c684F1391C0935cB34C296e0DD9Cb": "BCT / WPOL",
  "0x19F3DF2F5900705E8a6DfeBEC0f02ccd10437C0f": "LGP / UNI",
  "0xDFBd6bFd5875463C33e0c18c1FC43aA22f7B84b5": "LGP / WPOL",
  "0x395106988f425dC4c85b1997b7063cFe38C64278": "USDGLO / LGP",
  "0x17Be99a282559a24E57ED4f7FA436665200F890b": "DHG / CRISP-M",
  "0x61646724babcdeb4f70683a5b7c46d2bde506ee8": "IGS / USDGLO",
  "0xc9ec8a430e194295c82d75e5900d22f3ed254268": "IGS / WBTC",
  "0xcd7c7a4843f1a32eb7a1e0e23b2a7430505b5e4e": "LTK / IGS",
  "0x8bc8fefd43e02709020b329ee083ed949475b187": "LTK / CCC",
  "0x8e7bf0585de030cE2e04454728Dfc32240F87865": "AU24T / EGP",
  "0x9ED12034939CC2e9f01060F48c8e3e8B67880575": "Grant Wizard / EGP",
  "0x1395E5CBcA1F9cce3271EAd9cA3F727EA6E78cBa": "BTN / WBTC",
  "0x553b5414C109963C636EfE142C8eB6bA2908f55C": "BTN / WPOL",
  "0xc174118B4e8009F525a0464744d4BFEA30F67D9d": "USDGLO / BTN",
  "0xDB217EE8aeee2f344fEE7a9b53E73cc68f7321f3": "OGC / WBTC",
  "0xFD18f7baA05D19fF953D92bEa53a3D6B70F0B52c": "TB01 / OGC",
  "0x0fdEF11A0B332B3E723D181c0cB5Cb10eA52d135": "PKT / USDT0",
  "0xCd0bAd3Af02b36725A82128469b03535e0d48F2A": "EGP / PKT",
  "0xd815d289604bD1109e2F3A9B919d7f3D1f2B99fb": "EGP / WETH",
  "0x19e01FC41c8cC561D47e615F3509cd2e128e259B": "EGP / WPOL",
  "0xEb5b6e6AC30fB8949269a88814925B2639eede4b": "USDGLO / EGP",
  "0x520a3b3faca7ddc8dc8cd3380c8475b67f3c7b8d": "DDD / REGEN",
  "0x0d0ac298f5f1970c0f48c3084dd2d48a1fd24242": "DDD / LGP",
  "0xa628e29a8f0dfcb974bc387ddb933c5fd019a0b7": "EGP / WBTC",
  "0xcb8ecb17365ad243f64839aea81f40679e0c8c9a": "OGC / USDGLO",
  "0xdc12e9f5e9daf92df08e5d781c57bb92d5f110ef": "PKT / WBTC",
  "0x0f8f67f4143485bf3afd76389da9a8c745320da6": "PKT / BTN",
  "0x2be03aca43921852d389c65ae82bb9c2f3069f11": "PKT / USDGLO",
  "0x3782611c293e4519a386ff848a0d04827111b225": "DHG / WPOL",
  "0x93064cb5fc83919cf608a699a847b64360180e6e": "CCC / WBTC",
  "0x4316dc9f32110f9bef901347cf7b4cdb463e9cb3": "CCC / WETH",
  "0xc9131f6408e31c8fced33f12a031a1b3e2bea080": "CCC / WPOL",
  "0xcAe2c5BbC8d6f768cA73CF9Bd84A0C90CC492f43": "DDD / WBTC",
  "0x9C4e724a226a4103DC0a303C902357Bcbc7413AF": "DDD / WPOL",
  "0x7eE2dd0022e3460177B90b8F8fa3b3a76D970FF6": "USDGLO / DDD",
  "0xbA262Af3E1c559246e407C94C91F77Ff334F6a90": "EGP / DDD",
  "0x43c9b0DFdaFF40c38a24850636662394EF42D03F": "PR25 / DDD",
};

export async function POST() {
  const results = { nfts: 0, lp_pairs: 0, errors: [] as string[] };

  // Seed NFTs
  const nftRows = GAME_NFTS.map(n => ({
    name: n.name,
    contract_address: n.contractAddress.toLowerCase(),
    chain: n.chain,
  }));

  // Insert in batches of 50
  for (let i = 0; i < nftRows.length; i += 50) {
    const batch = nftRows.slice(i, i + 50);
    const { error } = await supabase.from("nfts").upsert(batch, { onConflict: "contract_address,chain" });
    if (error) results.errors.push(`nfts batch ${i}: ${error.message}`);
    else results.nfts += batch.length;
  }

  // Seed LP Pairs
  const lpRows: { pair_address: string; chain: string; label: string | null }[] = [];
  for (const addr of KNOWN_LP_PAIRS.base) {
    lpRows.push({ pair_address: addr.toLowerCase(), chain: "base", label: LP_LABELS[addr.toLowerCase()] ?? null });
  }
  for (const addr of KNOWN_LP_PAIRS.polygon) {
    lpRows.push({ pair_address: addr.toLowerCase(), chain: "polygon", label: LP_LABELS[addr.toLowerCase()] ?? null });
  }

  for (let i = 0; i < lpRows.length; i += 50) {
    const batch = lpRows.slice(i, i + 50);
    const { error } = await supabase.from("lp_pairs").upsert(batch, { onConflict: "pair_address,chain" });
    if (error) results.errors.push(`lp_pairs batch ${i}: ${error.message}`);
    else results.lp_pairs += batch.length;
  }

  return NextResponse.json(results);
}
