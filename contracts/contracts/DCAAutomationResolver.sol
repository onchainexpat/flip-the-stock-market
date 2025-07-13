// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DCA Automation Resolver
 * @notice Gelato-compatible resolver for DCA order execution
 * @dev This contract determines when DCA orders should be executed
 */
contract DCAAutomationResolver is Ownable, ReentrancyGuard {
    
    struct DCAOrder {
        address user;
        address smartWallet;
        string agentKeyId;
        address sellToken;
        address buyToken;
        uint256 amountPerExecution;
        uint256 frequency;
        uint256 totalExecutions;
        uint256 executionsCompleted;
        uint256 lastExecutionTime;
        bool isActive;
    }
    
    mapping(bytes32 => DCAOrder) public dcaOrders;
    mapping(address => bytes32[]) public userOrders;
    bytes32[] public allOrderIds;
    mapping(address => bool) public authorizedExecutors;
    
    // Events
    event OrderCreated(bytes32 indexed orderId, address indexed user);
    event OrderExecuted(bytes32 indexed orderId, uint256 executionCount);
    event OrderCompleted(bytes32 indexed orderId);
    event OrderCancelled(bytes32 indexed orderId);
    event ExecutorAuthorized(address indexed executor);
    event ExecutorRevoked(address indexed executor);
    event UnauthorizedAttempt(address indexed caller);
    
    // Errors
    error OrderNotFound();
    error OrderNotActive();
    error OrderNotReady();
    error UnauthorizedCaller();
    
    /**
     * @notice Create a new DCA order
     * @param orderId Unique identifier for the order
     * @param user Address of the user
     * @param smartWallet Address of the smart wallet
     * @param agentKeyId Agent key identifier for execution
     * @param sellToken Token to sell
     * @param buyToken Token to buy
     * @param amountPerExecution Amount to swap per execution
     * @param frequency Time between executions in seconds
     * @param totalExecutions Total number of executions
     */
    function createOrder(
        bytes32 orderId,
        address user,
        address smartWallet,
        string memory agentKeyId,
        address sellToken,
        address buyToken,
        uint256 amountPerExecution,
        uint256 frequency,
        uint256 totalExecutions
    ) external onlyOwner {
        require(dcaOrders[orderId].user == address(0), "Order already exists");
        
        dcaOrders[orderId] = DCAOrder({
            user: user,
            smartWallet: smartWallet,
            agentKeyId: agentKeyId,
            sellToken: sellToken,
            buyToken: buyToken,
            amountPerExecution: amountPerExecution,
            frequency: frequency,
            totalExecutions: totalExecutions,
            executionsCompleted: 0,
            lastExecutionTime: 0,
            isActive: true
        });
        
        userOrders[user].push(orderId);
        allOrderIds.push(orderId);
        
        emit OrderCreated(orderId, user);
    }
    
    /**
     * @notice Gelato resolver function - checks if execution is needed
     * @return canExec Whether execution should proceed
     * @return execPayload Encoded function call for execution
     */
    function checker() external view returns (bool canExec, bytes memory execPayload) {
        // Find orders ready for execution
        bytes32[] memory readyOrders = new bytes32[](10); // Max 10 orders per execution
        uint256 readyCount = 0;
        
        uint256 currentTime = block.timestamp;
        
        for (uint256 i = 0; i < allOrderIds.length && readyCount < 10; i++) {
            bytes32 orderId = allOrderIds[i];
            DCAOrder storage order = dcaOrders[orderId];
            
            if (order.isActive && 
                order.executionsCompleted < order.totalExecutions &&
                currentTime >= order.lastExecutionTime + order.frequency) {
                
                readyOrders[readyCount] = orderId;
                readyCount++;
            }
        }
        
        if (readyCount > 0) {
            // Trim array to actual size
            bytes32[] memory trimmedOrders = new bytes32[](readyCount);
            for (uint256 i = 0; i < readyCount; i++) {
                trimmedOrders[i] = readyOrders[i];
            }
            
            canExec = true;
            execPayload = abi.encodeWithSelector(
                this.executeOrders.selector,
                trimmedOrders
            );
        }
    }
    
    /**
     * @notice Execute multiple DCA orders
     * @param orderIds Array of order IDs to execute
     */
    function executeOrders(bytes32[] calldata orderIds) external nonReentrant {
        if (!(msg.sender == owner() || msg.sender == address(this) || authorizedExecutors[msg.sender])) {
            emit UnauthorizedAttempt(msg.sender);
            revert("Unauthorized");
        }
        
        for (uint256 i = 0; i < orderIds.length; i++) {
            _executeOrder(orderIds[i]);
        }
    }
    
    /**
     * @notice Internal function to execute a single order
     * @param orderId The order ID to execute
     */
    function _executeOrder(bytes32 orderId) internal {
        DCAOrder storage order = dcaOrders[orderId];
        
        if (!order.isActive) revert OrderNotActive();
        if (order.executionsCompleted >= order.totalExecutions) revert OrderNotReady();
        if (block.timestamp < order.lastExecutionTime + order.frequency) revert OrderNotReady();
        
        // Update order state
        order.executionsCompleted++;
        order.lastExecutionTime = block.timestamp;
        
        // Mark as completed if all executions done
        if (order.executionsCompleted >= order.totalExecutions) {
            order.isActive = false;
            emit OrderCompleted(orderId);
        }
        
        emit OrderExecuted(orderId, order.executionsCompleted);
        
        // Note: Actual swap execution would be handled by off-chain executor
        // This contract only manages the scheduling and state
    }
    
    /**
     * @notice Cancel an active order
     * @param orderId The order ID to cancel
     */
    function cancelOrder(bytes32 orderId) external {
        DCAOrder storage order = dcaOrders[orderId];
        
        require(msg.sender == order.user || msg.sender == owner(), "Unauthorized");
        require(order.isActive, "Order not active");
        
        order.isActive = false;
        emit OrderCancelled(orderId);
    }
    
    /**
     * @notice Get order details
     * @param orderId The order ID
     * @return order The order details
     */
    function getOrder(bytes32 orderId) external view returns (DCAOrder memory order) {
        return dcaOrders[orderId];
    }
    
    /**
     * @notice Get user's orders
     * @param user The user address
     * @return orderIds Array of order IDs
     */
    function getUserOrders(address user) external view returns (bytes32[] memory orderIds) {
        return userOrders[user];
    }
    
    /**
     * @notice Get orders ready for execution
     * @return readyOrders Array of order IDs ready for execution
     */
    function getReadyOrders() external view returns (bytes32[] memory readyOrders) {
        uint256 currentTime = block.timestamp;
        uint256 readyCount = 0;
        
        // First pass: count ready orders
        for (uint256 i = 0; i < allOrderIds.length; i++) {
            bytes32 orderId = allOrderIds[i];
            DCAOrder storage order = dcaOrders[orderId];
            
            if (order.isActive && 
                order.executionsCompleted < order.totalExecutions &&
                currentTime >= order.lastExecutionTime + order.frequency) {
                readyCount++;
            }
        }
        
        // Second pass: populate array
        readyOrders = new bytes32[](readyCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allOrderIds.length && index < readyCount; i++) {
            bytes32 orderId = allOrderIds[i];
            DCAOrder storage order = dcaOrders[orderId];
            
            if (order.isActive && 
                order.executionsCompleted < order.totalExecutions &&
                currentTime >= order.lastExecutionTime + order.frequency) {
                readyOrders[index] = orderId;
                index++;
            }
        }
    }
    
    /**
     * @notice Get total number of orders
     * @return count Total order count
     */
    function getTotalOrders() external view returns (uint256 count) {
        return allOrderIds.length;
    }
    
    /**
     * @notice Authorize an executor (e.g., Gelato proxy)
     * @param executor Address to authorize
     */
    function authorizeExecutor(address executor) external onlyOwner {
        authorizedExecutors[executor] = true;
        emit ExecutorAuthorized(executor);
    }
    
    /**
     * @notice Revoke executor authorization
     * @param executor Address to revoke
     */
    function revokeExecutor(address executor) external onlyOwner {
        authorizedExecutors[executor] = false;
        emit ExecutorRevoked(executor);
    }
    
    /**
     * @notice Emergency pause function
     */
    function emergencyPause() external onlyOwner {
        // Implementation for emergency pause
        // Could disable all orders or specific functionality
    }
    
    /**
     * @notice Allow contract to receive ETH for gas payments
     */
    receive() external payable {
        // Contract can receive ETH to pay for Gelato fees
    }
    
    /**
     * @notice Withdraw ETH from contract (owner only)
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        payable(owner()).transfer(amount);
    }
}