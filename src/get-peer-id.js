'use strict'

const getPeerID = async (ipfs) => {
  return (await ipfs.id()).id
}

exports.getPeerID = getPeerID
