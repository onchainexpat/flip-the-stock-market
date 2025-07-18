const taskId = '0x99b0e6d90bec9cc03f2a41dbde9a10fc79f5b24b8cbc57f6e9f4bc7eef0a4309';

async function checkTaskStatus() {
  try {
    console.log(`🔍 Checking task status: ${taskId}`);
    
    const response = await fetch(`https://api.gelato.digital/tasks/status/${taskId}`);
    
    if (response.ok) {
      const taskStatus = await response.json();
      console.log('\n📊 Task Status:');
      console.log('   State:', taskStatus.taskState);
      console.log('   Created:', new Date(taskStatus.creationDate).toLocaleString());
      
      if (taskStatus.transactionHash) {
        console.log('   Transaction Hash:', taskStatus.transactionHash);
        console.log('   Basescan URL:', `https://basescan.org/tx/${taskStatus.transactionHash}`);
      }
      
      if (taskStatus.lastCheck) {
        console.log('   Last Check:', new Date(taskStatus.lastCheck).toLocaleString());
      }
      
      if (taskStatus.executionDate) {
        console.log('   Execution Date:', new Date(taskStatus.executionDate).toLocaleString());
      }
      
      console.log('\n🔧 Full Response:');
      console.log(JSON.stringify(taskStatus, null, 2));
      
    } else {
      console.log('❌ Failed to check task status:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error checking task status:', error);
  }
}

checkTaskStatus();