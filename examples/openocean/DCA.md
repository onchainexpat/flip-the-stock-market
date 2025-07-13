OpenOcean DCA API Integration Guide
OpenOcean provides an API interface for DCA (Dollar-Cost Averaging) trading, enabling developers to implement automated swaps. This guide will introduce how to use this feature's API.

Currently we only support the Base/Sonic/Berachain/BNB Chain/Ethereum, and will expand to other EVM chains in the near future. Below are the OpenOcean DCA contract addresses :

DCA V1 contract address(Base): 0x7F727EB80183D5dE9bdd11dF6b8C402bab1DF147 

DCA V2 contract address(Base/Sonic): 0x6cBB2598881940D08d5Ea3fA8F557E02996e1031
*If you're the first time integrating our DCA, please use the V2 contract address. V1 will be deprecated soon.

DCA Overview
The DCA feature allows users to automatically invest fixed amounts at regular intervals on the OpenOcean.

DCA Trading in 3 Steps
Create DCA Order

Cancel DCA Order (Optional)

Query User Orders

1. Create DCA Order
Set up your automatic investment plan by choosing how much and how often you want to invest.

Example request:

Copy
import axios from 'axios';
const response = await axios({
    url: 'https://open-api.openocean.finance/v1/8453/dca/swap',
    method: 'POST',
    data: {
      "makerAmount": "20000000", // total amount with decimals
      "takerAmount": "19983700", // optional,  with decimals
      "signature": "0x37e6...", // user sign messagae, get from the frontend sdk
      "orderHash": "0x8e89...", //order hash, get from the frontend sdk
      "orderMaker": "0xB3cb...",// wallet address
      "remainingMakerAmount": "20000000", // remaing amount
      "data": {
        "salt": "", // get from the frontend sdk
        "makerAsset": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // token address
        "takerAsset": "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // token address
        "maker": "0xB3cb...", // wallet address
        "receiver": "0x0000000000000000000000000000000000000000", // default value
        "allowedSender": "0x0000000000000000000000000000000000000000", // default value
        "makingAmount": "20000000", // with decimals
        "takingAmount": "19983700", // with decimals
        "makerAssetData": "0x", // default value, get from the frontend sdk
        "takerAssetData": "0x", // default value, get from the frontend sdk
        "getMakerAmount": "0x", // default value
        "getTakerAmount": "0x", // default value
        "predicate": "0x", // default value, get from the frontend sdk
        "permit": "0x", // default value, get from the frontend sdk
        "interaction": "0x" // get from the frontend sdk
      },
      "isActive": true,
      "chainId": 8453, // chainId
      "expireTime": 600, // expire time s, time * times
      "amountRate": "1.000816", // makerAmount/takerAmount
      "interaction": "0x", // default value
      "time": 300, // interval time, s
      "times": 2, // frequency
      "minPrice": "0.9", // optional, price range
      "maxPrice": "1.1" // optional, price range
      "version": "v2", // default as v1. Please use v2 for the first time integration.
      "referrer": "0xxxxxxxxxxxxxxxxxxx" // optional. It's the EOA address to set up fees and track data from your end.
      "referrerFee": "1" // optional. e.g.'1'= 1%. Enter the num to charge the platform fee on your end. 
    }
});
Example response:

Copy
{
  code: 200,
}
2. Cancel DCA Order
Cancel your automatic trading plan at any time.

Example request:

Copy
import axios from 'axios';
const response = await axios({
    url: 'https://open-api.openocean.finance/v1/8453/dca/cancel',
    method: 'POST',
    data: {
        orderHash: "0x1e48.."
    }
});
Example response:

Copy
{
  code: 200,
}
3. Query User Orders
Check your active and completed automatic trades.

Example request:

Copy
import axios from 'axios';
const response = await axios({
    url: 'https://open-api.openocean.finance/v1/8453/dca/address/0xb3cbeff0336baa4863cb51238bd6c35bdaab3d84',
    method: 'GET',
    params: {
      page: 1,
      limit: 10,
      statuses: [1,2,5],
      sortBy: "createDateTime",
    }
});
Example response:

Copy
{
    "code": 200,
    "data": [
        {
            "makerAmount": "8152924",
            "takerAmount": "8152800",
            "orderHash": "0x.......",
            "createDateTime": "2025-01-24T06:46:02.000Z",
            "orderMaker": "0x......",
            "remainingMakerAmount": "8152924",
            "makerBalance": null,
            "makerAllowance": null,
            "expireTime": "2025-01-24T06:48:02.000Z",
            "statuses": 4,
            "time": 60,
            "times": 1,
            "have_filled": 1,
            "minPrice": null,
            "maxPrice": null,
            "data": {
                "makerAsset": "0x.......",
                "makerAssetSymbol": "USDC",
                "makerAssetDecimals": 6,
                "makerAssetIcon": "https://s3.openocean.finance/token_logos/logos/1697507306331_35406629884386076.png",
                "takerAsset": "0x.......",
                "takerAssetSymbol": "AXLUSDC",
                "takerAssetDecimals": 6,
                "takerAssetIcon": "https://s3.openocean.finance/token_logos/logos/1691737494552_8963896068270643.png",
                "getMakerAmount": "0x.....",
                "getTakerAmount": "0x......",
                "makerAssetData": "0x",
                "takerAssetData": "0x",
                "salt": "666361339303",
                "permit": "0x",
                "predicate": "0x.......",
                "interaction": "0x",
                "makingAmount": "8152924",
                "takingAmount": "8152800",
                "maker": "0x......",
                "receiver": "0x....",
                "allowedSender": "0x....."
            },
            "makerRate": null,
            "takerRate": null
        }
    ]
}

API:
API
1.Create DCA order
POST https://open-api.openocean.finance/v1/:chainId/dca/swap

Path Parameters
Name
Type
Description
chainId*

number

8453, 146, 80094

Example

url: https://open-api.openocean.finance/v1/8453/dca/swap

body

Copy
{
  "makerAmount": "20000000", // total amount with decimals
  "takerAmount": "1", // default amount
  "signature": "0x37e6...", // user sign messagae, get from the frontend sdk
  "orderHash": "0x8e89...", //order hash, get from the frontend sdk
  "orderMaker": "0xB3cb...",// wallet address
  "remainingMakerAmount": "20000000", // remaining amount
  "data": {
    "salt": "", // get from the frontend sdk
    "makerAsset": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // token address
    "takerAsset": "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // token address
    "maker": "0xB3cb...", // wallet address
    "receiver": "0x0000000000000000000000000000000000000000", // default value
    "allowedSender": "0x0000000000000000000000000000000000000000", // default value
    "makingAmount": "20000000", // with decimals
    "takingAmount": "19983700", // with decimals
    "makerAssetData": "0x", // default value, get from the frontend sdk
    "takerAssetData": "0x", // default value, get from the frontend sdk
    "getMakerAmount": "0x", // default value
    "getTakerAmount": "0x", // default value
    "predicate": "0x", // default value, get from the frontend sdk
    "permit": "0x", // default value, get from the frontend sdk
    "interaction": "0x" // get from the frontend sdk
  },
  "isActive": true,
  "chainId": 8453, // chainId
  "expireTime": 600, // expire time s, time * times
  "amountRate": "1.000816", // makerAmount/takerAmount
  "interaction": "0x", // default value
  "time": 300, // interval time, s
  "times": 2, // frequency
  "minPrice": "0.9", // optional, price range
  "maxPrice": "1.1", // optional, price range
  "version": "v2", // optional, default is v1. Please use v2 as first time integration.
  "referrer": "0xxxxxxxxxxxxxxxxxxx" // optional. It's the EOA address to set up fees and track data from your end.
  "referrerFee": "1" // optional. "1"=1%. Enter the num to charge the platform fee on your end. The range will be 0-5%
}
If you are willing to set a platform fee on your end, you could include the params of "referrer" &"referrerFee" shown in above example. It only applies to DCA V2 version.

referrer is an EOA address to add. It is used for to collect the fee you charged. Meanwhile, it could help us to track data flow from your end.

referrerFee is the number set to charge, e.g. "1" is equal to "1%". OpenOcean will take 20% of the platform fee charge as default. If you are not willing to charge, you could either set it as 0 or not include the params. 

Please note there's a min. required amount for below supported chains per transaction:

Ethereum: at least $30

Other EVM Chains: at least $5

Time interval mush at least over 60s.

response

Copy
{
    code: 200
}
2.Cancel DCA order
POST https://open-api.openocean.finance/v1/:chainId/dca/cancel

Path Parameters
Name
Type
Description
chainId*

number

8453, 146, 80094

Request Body
Name
Type
Description
orderHash*

string

orderHash from sdk

Example
url: https://open-api.openocean.finance/v1/8453/dca/cancel

body

Copy
{
  "orderHash":"0x1e48...",
}
response

Copy
{
    code: 200,
}
3.Get DCA order by address
GET https://open-api.openocean.finance/v1/:chainId/dca/address/:address

Path Parameters
Name
Type
Description
chainId*

number

8453, 146, 80094

address*

string

wallet address

Query Parameters
Name
Type
Description
statuses

array

status code: 1-unfill, 3-cancel, 4-filled, 5-pending, 6- hash not exist, 7-expire, default [1,3,4]

limit

number

limit count

200: OK https://open-api.openocean.finance/v1/8453/dca/address/0x......?statuses=[1,3,4]&limit=1
Copy
{
    "code": 200,
    "data": [
        {
            "makerAmount": "100000000",
            "takerAmount": "200000000000000000000",
            "orderHash": "0x......",
            "createDateTime": "2025-04-09T00:19:52.000Z",
            "orderMaker": "0x......",
            "remainingMakerAmount": "100000000",
            "makerBalance": null,
            "makerAllowance": null,
            "expireTime": "2025-04-17T00:19:53.000Z",
            "statuses": 1,
            "time": 86400,
            "times": 8,
            "have_filled": null,
            "minPrice": null,
            "maxPrice": null,
            "data": {
                "makerAsset": "0x.....",
                "makerAssetSymbol": "USDC",
                "makerAssetDecimals": 6,
                "makerAssetIcon": "https://s3.openocean.finance/token_logos/logos/1697507306331_35406629884386076.png",
                "takerAsset": "0x.....",
                "takerAssetSymbol": "ALB",
                "takerAssetDecimals": 18,
                "takerAssetIcon": "https://s3.openocean.finance/token_logos/logos/1693363980475_12272411021892027.png",
                "getMakerAmount": "0x.....",
                "getTakerAmount": "0x.....",
                "makerAssetData": "0x",
                "takerAssetData": "0x",
                "salt": "1033903786203",
                "permit": "0x",
                "predicate": "0x.....",
                "interaction": "0x",
                "makingAmount": "100000000",
                "takingAmount": "200000000000000000000",
                "maker": "0x.....",
                "receiver": "0x0000000000000000000000000000000000000000",
                "allowedSender": "0x0000000000000000000000000000000000000000"
            },
            "makerRate": null,
            "takerRate": null
        }
    ]
}
4.Get all DCA orders
GET https://open-api.openocean.finance/v1/:chainId/dca/all

Path Parameters
Name
Type
Description
chainId

number

8453, 146, 80094

Query Parameters
Name
Type
Description
statuses

array

status code: 1-unfill, 3-cancel, 4-filled, 5-pending, 6- hash not exist, 7-expire, default [1,3,4]

limit

number

limit count

200: OK https://open-api.openocean.finance/v1/8453/dca/all?statuses=[1,3,4]&limit=1
Copy
{
    "code": 200,
    "data": [
        {
            "makerAmount": "100000000",
            "takerAmount": "200000000000000000000",
            "orderHash": "0x......",
            "createDateTime": "2025-04-09T00:19:52.000Z",
            "orderMaker": "0x......",
            "remainingMakerAmount": "100000000",
            "makerBalance": null,
            "makerAllowance": null,
            "expireTime": "2025-04-17T00:19:53.000Z",
            "statuses": 1,
            "time": 86400,
            "times": 8,
            "have_filled": null,
            "minPrice": null,
            "maxPrice": null,
            "data": {
                "makerAsset": "0x.....",
                "makerAssetSymbol": "USDC",
                "makerAssetDecimals": 6,
                "makerAssetIcon": "https://s3.openocean.finance/token_logos/logos/1697507306331_35406629884386076.png",
                "takerAsset": "0x.....",
                "takerAssetSymbol": "ALB",
                "takerAssetDecimals": 18,
                "takerAssetIcon": "https://s3.openocean.finance/token_logos/logos/1693363980475_12272411021892027.png",
                "getMakerAmount": "0x.....",
                "getTakerAmount": "0x.....",
                "makerAssetData": "0x",
                "takerAssetData": "0x",
                "salt": "1033903786203",
                "permit": "0x",
                "predicate": "0x.....",
                "interaction": "0x",
                "makingAmount": "100000000",
                "takingAmount": "200000000000000000000",
                "maker": "0x.....",
                "receiver": "0x0000000000000000000000000000000000000000",
                "allowedSender": "0x0000000000000000000000000000000000000000"
            },
            "makerRate": null,
            "takerRate": null
        }
    ]
}

Browser Wallet SDK:
To integrate the DCA API, you'll need to use the Limit Order SDK, which provides functionality for creating and canceling limit orders.

Logo
GitHub - openocean-finance/OpenOcean-limit-order
GitHub
How to install the SDK in your project
Copy
npm i @openocean.finance/limitorder-sdk
How to use the SDK in your project
Copy
import { openoceanLimitOrderSdk } from '@openocean.finance/limitorder-sdk';
You can then use all the functions explored by the SDK (API and swapSDK).

Supported Provider Types
Type
Example
Description
Web3 provider

new Web3(window.ethereum)

Traditional MetaMask-style Web3.js

Ethers provider

new ethers.providers.Web3Provider(...) (v5) / new ethers.BrowserProvider(...) (v6)

Modern Ethers.js integration

Initialize Wallet Provider
Using Web3.js (web3-provider)
Copy
import Web3 from 'web3';

await window.ethereum.request({ method: 'eth_requestAccounts' });

const provider = new Web3(window.ethereum);
const address = await provider.eth.getAccounts();
Pass the provider to the SDK like this:

Copy
const sdkParams = {
  provider,                        // Web3 instance
  chainKey: 'base',                // Supported: base, arbitrum, etc.
  account: address[0],             // Wallet address
  chainId: 8453,                   // Chain ID
};
Using Ethers.js (ethers-provider)
Ethers v5

Copy
import { ethers } from 'ethers';

const provider = new ethers.providers.Web3Provider(window.ethereum); // v5
const signer = provider.getSigner();
const address = await signer.getAddress();
Ethers v6 (Recommended)

Copy
import { ethers } from 'ethers';

const provider = new ethers.BrowserProvider(window.ethereum); // v6
const signer = await provider.getSigner();
const address = await signer.getAddress();
Usage in SDK:

For DCA SDK, you would need to add a param of mode:'Dca' (Capitalized the D) when create the DCA orders.

Copy
const sdkParams = {
  provider,                  // Ethers provider (v5 or v6)
  chainKey: 'base',
  account: address,
  chainId: 8453,
  mode: 'Dca'
};
Create DCA Orders:
Copy
const orderData = await openoceanLimitOrderSdk.createLimitOrder(
  sdkParams,
  {
    makerTokenAddress: '0xabc...',
    takerTokenAddress: '0xdef...',
    makerTokenDecimals: 6,
    takerTokenDecimals: 6,
    makerAmount: '1000000', // 1.0 USDC
    takerAmount: '2000000', // 2.0 USDT
    gasPrice: parseInt(gasPrice * 1.2),
    expire: '1H', // Expiration time (e.g., "1H")
  }
);

let order = {
  ...orderData,
  expireTime: 180,
  time: 60, // 1 Minute
  times: 2,
  version: 'v2',
  // minPrice:1,
  // maxPrice:2,
}

const result = await axios.post(
  `https://open-api.openocean.finance/v1/${chainId}/dca/swap`,
  order,
  {
    headers: { 'Content-Type': 'application/json' },
  }
);
Cancel DCA Order
Copy

const { orderHash } = order;
const {data} = await axios.post(
  `https://open-api.openocean.finance/v1/${chainId}/dca/cancel`,
  { orderHash }
);
const { status } = (data && data.data) || {};
if (status && !(status === 3 || status === 4)) {
  let res = await openoceanLimitOrderSdk.cancelLimitOrder(
    {
      provider: this.provider,
      chainKey: this.chainName,
      account: this.myWallet.address,
      chainId: this.chain.chainId,
      mode: 'Dca'
    },
    {
      orderData: order.data,
      gasPrice: parseInt(this.gasPrice*1.2),
    }
  );
}
Demo
Copy
<template>
  <div id="app">
    <div style="color:blue">
      <div v-if="chain">chain:{{ chain.chainName }}</div>
      <div v-if="myWallet"> walletName:{{ myWallet.name }}</div>
      <div v-if="myWallet">address:{{ myWallet.address }}</div>
    </div>
    <div>
      <div>
        <h3>Connect Wallet Web3</h3>
        <button @click="ConnectWalletWeb3()" style="margin-right:10px">ConnectWalletWeb3</button>
      </div>
      <div>
        <h3>Connect Wallet Ethers</h3>
        <button @click="ConnectWalletEthers()" style="margin-right:10px">ConnectWalletEthers</button>
      </div>

      <div>
        <h3>createLimitOrder</h3>
        <button @click="createLimitOrder">createLimitOrder</button>
      </div>
      <div>
        <h3>Orders</h3>
      </div>
      <div v-for="(item, i) in orders" :key="i">
        <!-- {{ item.data }} -->
        <span>{{ item.data.makerAssetSymbol }}</span>
        <span>-></span>
        <span>{{ item.data.takerAssetSymbol }}</span>
        <button v-if="item.statuses === 5 || item.statuses === 1" @click="cancelOrder(item)">cancelOrder</button>
      </div>
      <div id="chart" style="width: 100%; height: 400px; border: 1px solid #c00;">

      </div>

    </div>
  </div>
</template>

<script>
import { openoceanLimitOrderSdk } from '@openocean.finance/limitorder-sdk';
import axios from 'axios';
import { ethers } from 'ethers';
import Web3 from 'web3';

export default {
  name: 'App',
  components: {
  },
  data () {
    return {
      chainName: 'base',
      outToken: {
        "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        "decimals": 6,
        "symbol": "USDC",
      },
      inToken: {
        "address": "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
        "decimals": 6,
        "symbol": "USDT"
      },

      // chainName: 'arbitrum',
      // inToken: {
      //   "address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      //   "decimals": 6,
      //   "symbol": "USDC",
      // },
      // outToken: {
      //   "address": "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
      //   "decimals": 6,
      //   "symbol": "USDT"
      // },

      gasPrice:0,
      walletName: 'MetaMask',
      inTokenBalance: null,
      outTokenBalance: null,
      inAmount: 1,
      outAmount: null,

      myWallet: null,
      chain: null,
      provider: null,
      limitOrderExpireOptions: [
        {
          value: "10M",
          label: "10 Mins",
        },
        {
          value: "1H",
          label: "1 Hour",
        },
        {
          value: "1D",
          label: "1 Day",
        },
        {
          value: "3D",
          label: "3 Days",
        },
        {
          value: "7D",
          label: "7 Days",
        },
        {
          value: "30D",
          label: "1 Month",
        },
        {
          value: "3Month",
          label: "3 Month",
        },
        {
          value: "6Month",
          label: "6 Month",
        },
        {
          value: "1Y",
          label: "1 Year",
        }
      ],

      orders: []
    }
  },


  async created () {
  },
  mounted () {
    this.loadChart()
  },
  methods: {
    async createLimitOrder () {
      if(!this.provider) {
        alert('Please connect wallet first')
        return
      }
      const p = {
        provider: this.provider,
        chainKey: this.chainName,
        account: this.myWallet.address,
        chainId: this.chain.chainId,
        mode: 'Dca'
      }
      let orderData = await openoceanLimitOrderSdk.createLimitOrder(
        p,
        {
          makerTokenAddress: this.inToken.address,
          makerTokenDecimals: this.inToken.decimals,
          takerTokenAddress: this.outToken.address,
          takerTokenDecimals: this.outToken.decimals,
          makerAmount: 0.01 * (10 ** this.inToken.decimals) + '',
          takerAmount:1, //"1" as default',
          gasPrice: parseInt(this.gasPrice*1.2),
          expire: this.limitOrderExpireOptions[1].value,
        }
      );

      let order = {
        ...orderData,
        expireTime: 180,
        time: 60, // 1 Minute
        times: 2,
        version: 'v2',
        // minPrice:1,
        // maxPrice:2,
      }

      const result = await axios.post(
        `https://open-api.openocean.finance/v1/${this.chain.chainId}/dca/swap`,
        order,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      this.getLimitOrder()
    },
    async getLimitOrder () {
      let url = `https://open-api.openocean.finance/v1/${this.chain.chainId}/dca/address/${this.myWallet.address}?page=1&limit=100&statuses=[1,2,5]&sortBy=createDateTime&exclude=0`
      const res = await axios.get(url);
      this.orders = res.data.data
    },
    async cancelOrder (order) {

      const { orderHash } = order;
      const {data} = await axios.post(
        `https://open-api.openocean.finance/v1/${this.chain.chainId}/dca/cancel`,
        { orderHash }
      );
      const { status } = (data && data.data) || {};
      if (status && !(status === 3 || status === 4)) {
        let res = await openoceanLimitOrderSdk.cancelLimitOrder(
          {
            provider: this.provider,
            chainKey: this.chainName,
            account: this.myWallet.address,
            chainId: this.chain.chainId,
            mode: 'Dca'
          },
          {
            orderData: order.data,
            gasPrice: parseInt(this.gasPrice*1.2),
          }
        );
      }
      this.getLimitOrder()
    },
    async ConnectWalletWeb3 () {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });

        this.provider = new Web3(window.ethereum);

        const address = await this.provider.eth.getAccounts();
        const gasPrice = await this.provider.eth.getGasPrice();
        this.gasPrice = Number(gasPrice);
        console.log(this.gasPrice);
        this.myWallet = {
          address: address[0],
          name: 'metamask'
        }
        this.chain = {
          chainId: this.chainName === 'base' ? 8453 : 42161,
          chainName: this.chainName
        }
        this.getLimitOrder()

      } catch (error) {
        this.myWallet = null
        this.chain = null
      }
    },
    async ConnectWalletEthers () {
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      // this.provider = new ethers.providers.Web3Provider(window.ethereum); //ethers v5
      this.provider = new ethers.BrowserProvider(window.ethereum); //ethers v6

      let gasData = await this.provider.getFeeData();
      this.gasPrice = Number(gasData.gasPrice);
      console.log(this.gasPrice);
      const signer = await this.provider.getSigner();
      const address = await signer.getAddress();
      this.myWallet = {
        address: address,
        name: 'metamask'
      }
      this.chain = {
        chainId: this.chainName === 'base' ? 8453 : 42161,
        chainName: this.chainName
      }
      this.getLimitOrder()

      console.log(address);
    },
    async loadChart () {
      await openoceanLimitOrderSdk.loadChart({
        chain: this.chainName, // chain code, 
        fromTokenSymbol: this.inToken.symbol, // from token symbol
        toTokenSymbol: this.outToken.symbol, // to token symbol
        container: document.getElementById('chart'), // chart's container
        timeLimit: "1d", // 1d、1w、1m、1y、all
        theme: "dark", // dark、light
        type: "line", // line、bar
        setPoint: ({ label, des }) => { // setPoint callback
          console.log('setPoint', label, des);
        }
      })
    }
  }
}

</script>

<style></style>

Private Key Wallet SDK:
Private Key Wallet SDK
To integrate the DCA API, you'll need to use the Limit Order SDK, which provides functionality for creating and canceling limit orders.

How to Install the sdk in your project
Copy
npm i @openocean.finance/limitorder-sdk
How to use the sdk in your project
Copy
import { openoceanLimitOrderSdk } from '@openocean.finance/limitorder-sdk';
For DCA SDK, you would need to add a param of 'Dca' (Capitalized the D) when create the DCA orders.

Setup with Private Key Wallet
1. Configuration
Copy
const privateKey = 'YOUR_PRIVATE_KEY';
const chainId = '8453';
const providerUrl = 'https://base.llamarpc.com';
const baseUrl = 'https://open-api.openocean.finance';

const inToken = {
  address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
  decimals: 6
};

const outToken = {
  address: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', // USDT
  decimals: 6
};
2. Web3.js Setup
Copy
import Web3 from 'web3';
import { openoceanLimitOrderSdk, WalletParams } from '@openocean.finance/limitorder-sdk';

const web3 = new Web3(providerUrl);
const account = web3.eth.accounts.privateKeyToAccount(privateKey);
web3.eth.accounts.wallet.add(account);

const web3Params: WalletParams = {
  provider: web3,
  chainId: chainId,
  chainKey: 'base',
  account: account.address,
  mode: 'Dca'
};
3. Ethers.js Setup
Ethers v5

Copy
import { ethers } from 'ethers';

const ethersProvider = new ethers.providers.JsonRpcProvider(providerUrl);
const signer = new ethers.Wallet(privateKey, ethersProvider);

const ethersParams: WalletParams = {
  provider: ethersProvider,
  signer: signer,
  account: ethersSigner.address,
  chainId: chainId,
  chainKey: 'base',
  mode: 'Dca'
};
Ethers v6 Warning

If using Ethers v6, make sure to import correctly:

Copy
import { JsonRpcProvider, Wallet } from 'ethers';
const provider = new JsonRpcProvider(providerUrl);
const signer = new Wallet(privateKey, provider);
Creating Dca Order
Copy
const orderData = await openoceanLimitOrderSdk.createLimitOrder(
  web3Params, // or ethersParams
  {
    makerTokenAddress: inToken.address,
    makerTokenDecimals: inToken.decimals,
    takerTokenAddress: outToken.address,
    takerTokenDecimals: outToken.decimals,
    makerAmount: (0.1 * 10 ** inToken.decimals).toString(),
    takerAmount: (0.2 * 10 ** outToken.decimals).toString(),
    gasPrice: estimatedGas, // optional
    expire: '6Month'        // optional: '1H', '1D', '6Month' etc.
  }
);

// Submit to OpenOcean
let order = {
  ...orderData,
  expireTime: 180,
  time: 60, // 1 Minute
  times: 2,
  version: 'v2',
  // minPrice:1,
  // maxPrice:2,
}
// Submit the order to OpenOcean API
const result = await axios.post(
  `https://open-api.openocean.finance/v1/${chainId}/dca/swap`,
  order,
  {
    headers: { 'Content-Type': 'application/json' },
    }
  );
console.log('Order created:', result.data);
Canceling Dca Order
Copy
const result = await axios.post(
  `${baseUrl}/v1/${chainId}/limit-order/cancelLimitOrder`,
  { orderHash: order.orderHash }
);

// If on-chain cancel is needed:
await openoceanLimitOrderSdk.cancelLimitOrder(
  web3Params, // or ethersParams
  {
    orderData: order.data,
    gasPrice: '...' // optional
  }
);

Querying Orders
Copy
const { data } = await axios.get(
  `${baseUrl}/v1/${chainId}/limit-order/address/${walletAddress}?statuses=[1,2,5]`
);
console.log('User orders:', data.data);
Demo
Copy
import { openoceanLimitOrderSdk, WalletParams } from '@openocean.finance/limitorder-sdk';
import Web3 from "web3";
import { ethers } from "ethers5";
import { JsonRpcProvider, Wallet } from "ethers6";

import axios from "axios";


const chainId = '8453'
const providerUrl = 'https://base.llamarpc.com';

// Wallet private key - please replace with your actual private key
const privateKey = 'your private key'

const inToken = {
  "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "decimals": 6,
  "symbol": "USDC",
}
// Token configuration for WETH
const outToken = {
  "address": "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
  "decimals": 6,
  "symbol": "USDT"
}


// OpenOcean API base URL
const baseUrl = 'https://open-api.openocean.finance'

// Initialize providers and signers
// Web3.js setup
const web3 = new Web3(providerUrl);
const account = web3.eth.accounts.privateKeyToAccount(privateKey);
web3.eth.accounts.wallet.add(account);


// Ethers.js setup
//ethers v5
const ethersProvider = new ethers.providers.JsonRpcProvider(providerUrl)
const ethersSigner = new ethers.Wallet(privateKey, ethersProvider);

// ethers v6
// const ethersProvider = new JsonRpcProvider(providerUrl);
// const ethersSigner = new Wallet(privateKey, ethersProvider);


// Initialize Web3.js WalletParams
const web3Params: WalletParams = {
  provider: web3,
  chainId: chainId,
  chainKey: 'base',
  account: account.address,
  mode: 'Dca'
};

// Initialize Ethers.js WalletParams
const ethersParams: WalletParams = {
  provider: ethersProvider,
  chainId: chainId,
  chainKey: 'base',
  account: ethersSigner.address,
  mode: 'Dca',

  signer: ethersSigner
};

/**
 * Create limit order using Web3.js
 * This function creates a limit order to exchange 0.1 USDC for 0.2 USDT using Web3.js.
 */
async function testCreateWeb3() {
  try {
    // Get current gas price from the network
    const gasPrice = await web3.eth.getGasPrice();
    console.log('Web3 gasPrice:', gasPrice);

    // Build limit order data
    const orderData = await openoceanLimitOrderSdk.createLimitOrder(
      web3Params,
      {
        makerTokenAddress: inToken.address,
        makerTokenDecimals: inToken.decimals,
        takerTokenAddress: outToken.address,
        takerTokenDecimals: outToken.decimals,
        makerAmount: (0.1 * (10 ** inToken.decimals)).toString(),
        takerAmount: (0.2 * (10 ** outToken.decimals)).toString(),
        gasPrice: parseInt((Number(gasPrice) * 1.2) + ''),
        expire: '6Month'
      }
    );

    let order = {
      ...orderData,
      expireTime: 180,
      time: 60, // 1 Minute
      times: 2,
      version: 'v2',
      // minPrice:1,
      // maxPrice:2,
    }
    
    // Submit the order to OpenOcean API
    const result = await axios.post(
      `https://open-api.openocean.finance/v1/${chainId}/dca/swap`,
      order,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    console.log('Web3.js create order result:', result.data);
    return result.data;
  } catch (error) {
    console.error('Web3.js create order failed:', error);
    throw error;
  }
}

/**
 * Create limit order using Ethers.js
 * This function creates a limit order to exchange 0.1 USDC for 0.2 USDT using Ethers.js.
 */
async function testCreateEthers() {
  try {
    // Get current gas price from the network
    const feeData = await ethersProvider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);
    console.log('Ethers gasPrice:', gasPrice);

    // Build limit order data
    const orderData = await openoceanLimitOrderSdk.createLimitOrder(
      ethersParams,
      {
        makerTokenAddress: inToken.address,
        makerTokenDecimals: inToken.decimals,
        takerTokenAddress: outToken.address,
        takerTokenDecimals: outToken.decimals,
        makerAmount: (0.1 * (10 ** inToken.decimals)).toString(),
        takerAmount: (0.2 * (10 ** outToken.decimals)).toString(),
        gasPrice: parseInt((Number(gasPrice) * 1.2) + ''),
        expire: '6Month'
      }
    );

    let order = {
      ...orderData,
      expireTime: 180,
      time: 60, // 1 Minute
      times: 2,
      version: 'v2',
      // minPrice:1,
      // maxPrice:2,
    }
    // Submit the order to OpenOcean API
    const result = await axios.post(
      `https://open-api.openocean.finance/v1/${chainId}/dca/swap`,
      order,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    console.log('Ethers.js create order result:', result.data);
    return result.data;
  } catch (error) {
    console.error('Ethers.js create order failed:', error);
    throw error;
  }
}

/**
 * Cancel limit order using Web3.js
 * This function cancels the first order in the user's order list using Web3.js.
 */
async function testCancelWeb3() {
  try {

    // Get user's order list
    const orderList = await getOrderList(account.address);

    if (orderList && orderList.length) {
      const order = orderList[0];
      // Try to cancel via OpenOcean API
      const result = await axios.post(
        `https://open-api.openocean.finance/v1/${chainId}/dca/cancel`,
        { orderHash: order.orderHash }
      );

      // If API cancellation fails, try on-chain cancellation
      const { status } = (result && result.data && result.data.data) || {};
      console.log('Web3.js cancel order result:', result.data.data);
      if (!(status === 3 || status === 4)) {
        const gasPrice = await web3.eth.getGasPrice();
        console.log('Web3 gasPrice:', gasPrice);
        const res = await openoceanLimitOrderSdk.cancelLimitOrder(
          web3Params,
          {
            orderData: order.data,
            // gasPrice: gasPrice.toString(),
          }
        );
        console.log('Web3.js cancel order result:', res);
        return res;
      }
    } else {
      console.log('No orders found to cancel');
    }
  } catch (error) {
    console.error('Web3.js cancel order failed:', error);
    throw error;
  }
}

/**
 * Cancel limit order using Ethers.js
 * This function cancels the first order in the user's order list using Ethers.js.
 */
async function testCancelEthers() {
  try {
    // Get user's order list
    const orderList = await getOrderList(ethersSigner.address);

    if (orderList && orderList.length) {
      const order = orderList[0];
      // Try to cancel via OpenOcean API
      const result = await axios.post(
        `https://open-api.openocean.finance/v1/${chainId}/dca/cancel`,
        { orderHash: order.orderHash }
      );

      console.log('Ethers.js cancel order result:', result.data.data);
      const { status } = (result && result.data && result.data.data) || {};
      if (!(status === 3 || status === 4)) {
        const feeData = await ethersProvider.getFeeData();
        const gasPrice = feeData.gasPrice || BigInt(0);

        const res = await openoceanLimitOrderSdk.cancelLimitOrder(
          ethersParams,
          {
            orderData: order.data,
            gasPrice: gasPrice.toString(),
          }
        );
        console.log('Ethers.js cancel order result:', res);
        return res;
      }
    } else {
      console.log('No orders found to cancel');
    }
  } catch (error) {
    console.error('Ethers.js cancel order failed:', error);
    throw error;
  }
}

/**
 * Get user's limit order list
 * This function fetches the user's limit orders with status 1 (active), 2 (filled), or 5 (expired).
 * @param address User wallet address
 * @returns Array of order objects
 */
async function getOrderList(address: string) {
  try {
    const reqUrl = `https://open-api.openocean.finance/v1/${chainId}/dca/address/${address}?page=1&limit=100&statuses=[1,2,5]&sortBy=createDateTime&exclude=0`
    const { data } = await axios.get(reqUrl);
    return data ? data.data : [];
  } catch (error) {
    console.error('Failed to get order list:', error);
    throw error;
  }
}

// Test cases
async function runTests() {
  try {
    console.log('Starting tests...');

    // Test Web3.js create order
    console.log('\nTesting Web3.js create order:');
    await testCreateWeb3();

    // Test Ethers.js create order
    console.log('\nTesting Ethers.js create order:');
    await testCreateEthers();


    // Test Web3.js cancel order
    console.log('\nTesting Web3.js cancel order:');
    await testCancelWeb3();

    // Test Ethers.js cancel order
    console.log('\nTesting Ethers.js cancel order:');
    await testCancelEthers();

    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

// Run tests
// runTests();

// Or run individual tests
// testCreateWeb3();
// testCreateEthers();

// testCancelWeb3();
// testCancelEthers();

// getOrderList(account.address);
// getOrderList(ethersSigner.address);
// getOrderList(browserWalletParams.account);
