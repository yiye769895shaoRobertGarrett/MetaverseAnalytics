// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract MetaverseAnalytics is SepoliaConfig {
    struct EncryptedInteraction {
        uint256 interactionId;
        address platform;
        euint32 avatarId1;
        euint32 avatarId2;
        euint32 locationX;
        euint32 locationY;
        euint32 duration;
        uint256 timestamp;
    }

    struct SpatialAnalysis {
        uint256 analysisId;
        euint32 hotspotScore;
        euint32 socialDensity;
        uint256 timestamp;
    }

    uint256 public interactionCount;
    uint256 public analysisCount;
    mapping(uint256 => EncryptedInteraction) public interactions;
    mapping(uint256 => SpatialAnalysis) public spatialAnalyses;
    mapping(address => uint256[]) public platformInteractions;
    mapping(address => bool) public authorizedPlatforms;

    event InteractionRecorded(uint256 indexed interactionId, address indexed platform, uint256 timestamp);
    event AnalysisRequested(uint256 indexed analysisId);
    event AnalysisCompleted(uint256 indexed analysisId, uint256 timestamp);

    modifier onlyAuthorized() {
        require(authorizedPlatforms[msg.sender], "Unauthorized platform");
        _;
    }

    constructor() {
        authorizedPlatforms[msg.sender] = true;
    }

    function authorizePlatform(address platform) external onlyAuthorized {
        authorizedPlatforms[platform] = true;
    }

    function recordInteraction(
        euint32 encryptedAvatar1,
        euint32 encryptedAvatar2,
        euint32 encryptedLocationX,
        euint32 encryptedLocationY,
        euint32 encryptedDuration
    ) external onlyAuthorized {
        interactionCount++;
        uint256 newId = interactionCount;

        interactions[newId] = EncryptedInteraction({
            interactionId: newId,
            platform: msg.sender,
            avatarId1: encryptedAvatar1,
            avatarId2: encryptedAvatar2,
            locationX: encryptedLocationX,
            locationY: encryptedLocationY,
            duration: encryptedDuration,
            timestamp: block.timestamp
        });

        platformInteractions[msg.sender].push(newId);
        emit InteractionRecorded(newId, msg.sender, block.timestamp);
    }

    function requestSpatialAnalysis() external onlyAuthorized {
        analysisCount++;
        uint256 newId = analysisCount;

        bytes32[] memory ciphertexts = new bytes32[](interactionCount * 5);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= interactionCount; i++) {
            ciphertexts[index++] = FHE.toBytes32(interactions[i].locationX);
            ciphertexts[index++] = FHE.toBytes32(interactions[i].locationY);
            ciphertexts[index++] = FHE.toBytes32(interactions[i].duration);
            ciphertexts[index++] = FHE.toBytes32(interactions[i].avatarId1);
            ciphertexts[index++] = FHE.toBytes32(interactions[i].avatarId2);
        }

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.performAnalysis.selector);
        emit AnalysisRequested(newId);
    }

    function performAnalysis(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) external {
        FHE.checkSignatures(requestId, cleartexts, proof);

        euint32[] memory results = abi.decode(cleartexts, (euint32[]));
        
        spatialAnalyses[requestId] = SpatialAnalysis({
            analysisId: requestId,
            hotspotScore: results[0],
            socialDensity: results[1],
            timestamp: block.timestamp
        });

        emit AnalysisCompleted(requestId, block.timestamp);
    }

    function getInteractionData(uint256 interactionId) external view onlyAuthorized returns (
        euint32, euint32, euint32, euint32, euint32
    ) {
        EncryptedInteraction storage interaction = interactions[interactionId];
        return (
            interaction.avatarId1,
            interaction.avatarId2,
            interaction.locationX,
            interaction.locationY,
            interaction.duration
        );
    }

    function getSpatialAnalysis(uint256 analysisId) external view onlyAuthorized returns (
        euint32, euint32
    ) {
        SpatialAnalysis storage analysis = spatialAnalyses[analysisId];
        return (analysis.hotspotScore, analysis.socialDensity);
    }

    function getPlatformInteractions(address platform) external view onlyAuthorized returns (
        uint256[] memory
    ) {
        return platformInteractions[platform];
    }
}