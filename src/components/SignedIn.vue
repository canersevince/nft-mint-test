<template>
  <div>
    <button @click="transaction()">Dummy NFT</button>
  </div>
</template>

<script>
import {logout} from "../utils"
import {utils} from 'near-api-js'

export default {
  name: "SignedIn",

  mounted() {
    if (this.isSignedIn) {
      window.contract.get_tokens({accountId: window.accountId}).then(response => {
        this.nfts = response
        console.log('get_tokens')
        console.log(response)
      }).catch(error => {
        console.log(error)
      })
      /* window.contract.get_token_owner({token_id: 3}).then(response => {
         console.log('get_token_owner id: 3')
         console.log(response)
       }).catch(error => {
         console.log(error)
       })*/
    }
  },

  components: {},

  data: function () {
    return {
      notificationVisible: false,
      nfts: [],
      name: "",
      description: "",
      image: "",
      transferOwner: "",
      amount: 1
    }
  },

  computed: {
    isSignedIn() {
      return window.walletConnection ? window.walletConnection.isSignedIn() : false
    },
    accountId() {
      return window.accountId
    },
    contractId() {
      return window.contract ? window.contract.contractId : null
    },
    networkId() {
      return window.networkId
    },
  },

  methods: {
    transferNFT(tokenId) {
      console.log(tokenId, "transfering")
      window.contract.transfer({new_owner_id: "seadox3.testnet", token_id: tokenId}).then(res => {
        console.log(res)
      }).catch(error => console.log(error))
    },
    createNFT(e) {
      e.preventDefault()
      const name = this.name
      const description = this.description
      const image = this.image
      const amount = parseInt(this.amount)

      return
      if (amount === 1) {
        window.contract.mint_token({name, description, image}, 100000000000000)
            .then(res => console.log(res))
            .catch(err => console.log(err))
      } else {
        window.contract.batch_mint({name, description, image, amount}, 100000000000000)
            .then(res => console.log(res))
            .catch(err => console.log(err))
      }
    },
    async transaction() {
      const name = "Charmander"
      const description = "It will be the strongest pokemon!"
      const image = "https://upload.wikimedia.org/wikipedia/tr/4/40/Charmander_Artwork.png"
      const amount = 5
      const transferAmount = await utils.format.parseNearAmount("20")
      console.log(transferAmount)
      window.contract
          .batch_mint_payment({name, description, image, amount: amount},
              300000000000000,
              transferAmount
          )
          .then(res => console.log(res))
          .catch(err => console.log(err))
    },
    logout: logout,
  },
}
</script>

<style>
body {
  overflow-x: hidden;
}

.w-100 {
  width: 100%
}

.nftList {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 1em;
  flex-wrap: wrap;
}

.nftList li {
  flex-basis: 30%;
  width: 30%
}

.nftList li h4 {
  max-width: 90%;
  text-overflow: ellipsis;
  overflow: hidden
}

.nftList li p {
  font-size: 12px;
  width: 90%;
  text-overflow: ellipsis;
}
</style>
