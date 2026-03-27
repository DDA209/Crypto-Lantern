// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract Contract {
    uint public x;

    function inc() public {
        x++;
    }

    function incBy(uint y) public {
        x += y;
    }
}