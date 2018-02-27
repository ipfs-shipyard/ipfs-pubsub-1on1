'use strict'

const getPeerID = (ipfs) => {
  return ipfs._peerInfo.id._idB58String || ipfs._peerInfo.id
}

exports.getPeerID = getPeerID
