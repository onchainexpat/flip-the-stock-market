// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol

pragma solidity ^0.8.0;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// File @openzeppelin/contracts/access/Ownable.sol

pragma solidity ^0.8.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// File @openzeppelin/contracts/security/ReentrancyGuard.sol

pragma solidity ^0.8.0;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be _NOT_ENTERED
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == _ENTERED;
    }
}

// File contracts/DCAAutomationResolver.sol

pragma solidity ^0.8.19;

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
    
    // Events
    event OrderCreated(bytes32 indexed orderId, address indexed user);
    event OrderExecuted(bytes32 indexed orderId, uint256 executionCount);
    event OrderCompleted(bytes32 indexed orderId);
    event OrderCancelled(bytes32 indexed orderId);
    
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
        require(msg.sender == owner() || msg.sender == address(this), "Unauthorized");
        
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
     * @notice Emergency pause function
     */
    function emergencyPause() external onlyOwner {
        // Implementation for emergency pause
        // Could disable all orders or specific functionality
    }
}