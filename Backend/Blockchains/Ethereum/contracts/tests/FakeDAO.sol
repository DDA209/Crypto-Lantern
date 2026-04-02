// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract fakeDAO {
    mapping(address => bool) public isDAO;

    modifier onlyDAO() {
        require(isDAO[msg.sender], "Not DAO");
        _;
    }

    constructor(address[] memory _dao) {
        for (uint256 i = 0; i < _dao.length; i++) {
            isDAO[_dao[i]] = true;
        }
    }

    function setDAO(address[] calldata _dao) external onlyDAO{
        for (uint256 i = 0; i < _dao.length; i++) {
            isDAO[_dao[i]] = true;
        }
    }
}