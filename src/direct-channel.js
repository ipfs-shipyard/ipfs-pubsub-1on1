'use strict'

const path = require('path')
const EventEmitter = require('events')
const PROTOCOL = require('./protocol')
const encode = require('./encoding')

/**
 * Communication channel over Pubsub between two IPFS nodes
 */
class DirectChannel extends EventEmitter {
  constructor (ipfs, peerID, options) {
    super()

    this._ipfs = ipfs

    if (!this._ipfs.pubsub) {
      throw new Error('This IPFS node does not support pubsub.')
    }

    // Channel's participants
    this._peers = Array.from([
      peerID, 
      this._ipfs._peerInfo.id._idB58String
    ]).sort()

    // ID of the channel is "<peer1 id>/<peer 2 id>""
    this._id = path.join('/', PROTOCOL, this._peers.join('/'))

    // Options
    this._options = Object.assign({}, { start: true }, options)

    // Message handler
    this._listener = message => {
      // Filter out all messages that didn't come from the second peer
      if (message && message.from === peerID) {
        this.emit('message', message)
      }
    }

    // Start communicating
    this._start()
  }

  /**
   * Channel ID
   * @return {[String]} Channel's ID
   */
  get id () {
    return this._id
  }

  /**
   * Peers participating in this channel
   * @return {[Array]} Array of peer IDs participating in this channel
   */
  get peers () {
    return this._peers
  }

  /**
   * Send a message to the other peer
   * @param  {[Any]} message Payload
   */
  send (message) {
    let m = encode(message)
    this._ipfs.pubsub.publish(this._id, m, (err) => {
      if (err) {
        this.emit('error', err)
      }
    })
  }

  /**
   * Close the channel
   */
  close () {
    this._ipfs.pubsub.unsubscribe(this._id, this._listener)    
  }

  _start () {
    this._ipfs.pubsub.subscribe(this._id, this._listener, (err) => {
      if (err) {
        this.emit('error', err)
      } else {
        this.emit('ready', this._id)
      }
    })    
  }
}

module.exports = DirectChannel
