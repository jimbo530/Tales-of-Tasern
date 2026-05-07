// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * BatchReader — single-call batch reads for D20 game NFT + LP data.
 * Deploy on both Base and Polygon. Pure view, no state, no owner.
 *
 * Replaces ~26,000 chunked multicalls with 2-3 calls per chain:
 *   1. batchPairInfo(pairs[])       — token0/token1/totalSupply/reserves
 *   2. batchLpBalances(nfts[],pairs[]) — LP balances for all NFT×pair combos
 *   3. batchNftBalances(nfts[],account,tokenId) — ERC1155 ownership
 */
contract BatchReader {

    struct PairInfo {
        address token0;
        address token1;
        uint256 totalSupply;
        uint112 reserve0;
        uint112 reserve1;
    }

    /// @notice Batch ERC1155 balanceOf(account, tokenId) across many NFT contracts
    function batchNftBalances(
        address[] calldata nfts,
        address account,
        uint256 tokenId
    ) external view returns (uint256[] memory balances) {
        balances = new uint256[](nfts.length);
        for (uint256 i = 0; i < nfts.length; i++) {
            // 0x00fdd58e = balanceOf(address,uint256) — ERC1155
            (bool ok, bytes memory data) = nfts[i].staticcall(
                abi.encodeWithSelector(0x00fdd58e, account, tokenId)
            );
            if (ok && data.length >= 32) {
                balances[i] = abi.decode(data, (uint256));
            }
        }
    }

    /// @notice Batch LP pair static data (token0, token1, totalSupply, reserves)
    function batchPairInfo(
        address[] calldata pairs
    ) external view returns (PairInfo[] memory infos) {
        infos = new PairInfo[](pairs.length);
        for (uint256 i = 0; i < pairs.length; i++) {
            address p = pairs[i];

            (bool ok0, bytes memory d0) = p.staticcall(abi.encodeWithSelector(0x0dfe1681)); // token0()
            if (ok0 && d0.length >= 32) infos[i].token0 = abi.decode(d0, (address));

            (bool ok1, bytes memory d1) = p.staticcall(abi.encodeWithSelector(0xd21220a7)); // token1()
            if (ok1 && d1.length >= 32) infos[i].token1 = abi.decode(d1, (address));

            (bool ok2, bytes memory d2) = p.staticcall(abi.encodeWithSelector(0x18160ddd)); // totalSupply()
            if (ok2 && d2.length >= 32) infos[i].totalSupply = abi.decode(d2, (uint256));

            (bool ok3, bytes memory d3) = p.staticcall(abi.encodeWithSelector(0x0902f1ac)); // getReserves()
            if (ok3 && d3.length >= 96) {
                (uint112 r0, uint112 r1,) = abi.decode(d3, (uint112, uint112, uint32));
                infos[i].reserve0 = r0;
                infos[i].reserve1 = r1;
            }
        }
    }

    /// @notice Batch LP balanceOf for NFT x pair grid
    /// @return balances Flat array: [nft0_pair0, nft0_pair1, ..., nft1_pair0, ...]
    function batchLpBalances(
        address[] calldata nfts,
        address[] calldata pairs
    ) external view returns (uint256[] memory balances) {
        uint256 total = nfts.length * pairs.length;
        balances = new uint256[](total);
        for (uint256 i = 0; i < nfts.length; i++) {
            for (uint256 j = 0; j < pairs.length; j++) {
                // 0x70a08231 = balanceOf(address) — ERC20
                (bool ok, bytes memory data) = pairs[j].staticcall(
                    abi.encodeWithSelector(0x70a08231, nfts[i])
                );
                if (ok && data.length >= 32) {
                    balances[i * pairs.length + j] = abi.decode(data, (uint256));
                }
            }
        }
    }

    /// @notice All-in-one: pair info + LP balances in a single call
    function batchAll(
        address[] calldata nfts,
        address[] calldata pairs
    ) external view returns (PairInfo[] memory infos, uint256[] memory balances) {
        // Pair info
        infos = new PairInfo[](pairs.length);
        for (uint256 i = 0; i < pairs.length; i++) {
            address p = pairs[i];
            (bool ok0, bytes memory d0) = p.staticcall(abi.encodeWithSelector(0x0dfe1681));
            if (ok0 && d0.length >= 32) infos[i].token0 = abi.decode(d0, (address));
            (bool ok1, bytes memory d1) = p.staticcall(abi.encodeWithSelector(0xd21220a7));
            if (ok1 && d1.length >= 32) infos[i].token1 = abi.decode(d1, (address));
            (bool ok2, bytes memory d2) = p.staticcall(abi.encodeWithSelector(0x18160ddd));
            if (ok2 && d2.length >= 32) infos[i].totalSupply = abi.decode(d2, (uint256));
            (bool ok3, bytes memory d3) = p.staticcall(abi.encodeWithSelector(0x0902f1ac));
            if (ok3 && d3.length >= 96) {
                (uint112 r0, uint112 r1,) = abi.decode(d3, (uint112, uint112, uint32));
                infos[i].reserve0 = r0;
                infos[i].reserve1 = r1;
            }
        }
        // LP balances
        uint256 total = nfts.length * pairs.length;
        balances = new uint256[](total);
        for (uint256 i = 0; i < nfts.length; i++) {
            for (uint256 j = 0; j < pairs.length; j++) {
                (bool ok, bytes memory data) = pairs[j].staticcall(
                    abi.encodeWithSelector(0x70a08231, nfts[i])
                );
                if (ok && data.length >= 32) {
                    balances[i * pairs.length + j] = abi.decode(data, (uint256));
                }
            }
        }
    }
}
