import {
    env,
    context,
    PersistentMap,
    storage,
    logging,
    ContractPromiseBatch,
    u128,
    PersistentUnorderedMap
} from 'near-sdk-as'
import {tokens, Token} from './model'
/**************************/
/* DATA TYPES AND STORAGE */
/**************************/

type AccountId = string
type TokenId = i32
// Note that MAX_SUPPLY is implemented here as a simple constant
// It is exported only to facilitate unit testing

// The strings used to index variables in storage can be any string
// Let's set them to single characters to save storage space
const tokenToOwner = new PersistentUnorderedMap<TokenId, AccountId>('a')
// Note that with this implementation, an account can only set one escrow at a
// time. You could make values an array of AccountIds if you need to, but this
// complicates the code and costs more in storage rent.
const escrowAccess = new PersistentMap<AccountId, AccountId>('e')

// This is a key in storage used to track the current minted supply
const TOTAL_SUPPLY = 't'
const init = "i"
const owner = "m"
/******************/
/* ERROR MESSAGES */
/******************/

// These are exported for convenient unit testing
export const ERROR_NO_ESCROW_REGISTERED = 'Caller has no escrow registered'
export const ERROR_CALLER_ID_DOES_NOT_MATCH_EXPECTATION = 'Caller ID does not match expectation'
export const ERROR_MAXIMUM_TOKEN_LIMIT_REACHED = 'Maximum token limit reached'
export const ERROR_OWNER_ID_DOES_NOT_MATCH_EXPECTATION = 'Owner id does not match real token owner id'
export const ERROR_TOKEN_NOT_OWNED_BY_CALLER = 'Token is not owned by the caller. Please use transfer_from for this scenario'

/******************/
/* CHANGE METHODS */

/******************/


// init contract owner
export function launch(): void {
    const i = storage.getPrimitive<boolean>(init, false)
    if (!i) {
        storage.set(owner, 'seadox3.testnet')
        storage.set(init, true)
    }
}

// Grant access to the given `accountId` for all tokens the caller has
export function grant_access(escrow_account_id: string): void {
    escrowAccess.set(context.predecessor, escrow_account_id)
}

// Revoke access to the given `accountId` for all tokens the caller has
export function revoke_access(escrow_account_id: string): void {
    escrowAccess.delete(context.predecessor)
}

// Transfer the given `token_id` to the given `new_owner_id`. Account `new_owner_id` becomes the new owner.
// Requirements:
// * The caller of the function (`predecessor`) should have access to the token.
export function transfer_from(owner_id: string, new_owner_id: string, token_id: TokenId): void {
    const predecessor = context.predecessor

    // fetch token owner and escrow; assert access
    const owner = tokenToOwner.getSome(token_id - 1)
    assert(owner == owner_id, ERROR_OWNER_ID_DOES_NOT_MATCH_EXPECTATION)
    const escrow = escrowAccess.get(owner)
    assert([owner, escrow].includes(predecessor), ERROR_CALLER_ID_DOES_NOT_MATCH_EXPECTATION)

    // assign new owner to token
    tokenToOwner.set(token_id, new_owner_id)
}


// Transfer the given `token_id` to the given `new_owner_id`. Account `new_owner_id` becomes the new owner.
// Requirements:
// * The caller of the function (`predecessor`) should be the owner of the token. Callers who have
// escrow access should use transfer_from.
export function transfer(new_owner_id: string, token_id: TokenId): void {
    assert(tokens.containsIndex(token_id - 1), "INDEX NOT EXIST")
    const predecessor = context.predecessor
    // fetch token owner and escrow; assert access
    const owner = tokenToOwner.getSome(token_id)
    assert(owner == predecessor, ERROR_TOKEN_NOT_OWNED_BY_CALLER + ' token id:' + token_id.toString() + '' + owner)
    // assign new owner to token
    let toReplace: i32 = -1
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] && tokens[i].TokenId == token_id) {
            toReplace = i32(i);
        }
    }
    logging.log('toReplace index' + toReplace.toString())
    if (toReplace >= 0) {
        const old = tokens[toReplace]
        const newT = new Token(old.name, old.description, old.image, new_owner_id, old.TokenId)
        tokens.replace(toReplace, newT)
        const val = tokenToOwner.get(token_id)
        if (val) {
            logging.log('toReplace > tokenToOwner ->' + val ? val.toString() : 'null')
        } else {
            logging.log('toReplace > tokenToOwner(id) -> null')
        }
        tokenToOwner.set(token_id, new_owner_id)
    }
}


/****************/
/* VIEW METHODS */

/****************/


// Returns `true` or `false` based on caller of the function (`predecessor`) having access to account_id's tokens
export function check_access(account_id: string): boolean {
    const caller = context.predecessor

    // throw error if someone tries to check if they have escrow access to their own account;
    // not part of the spec, but an edge case that deserves thoughtful handling
    assert(caller != account_id, ERROR_CALLER_ID_DOES_NOT_MATCH_EXPECTATION)

    // if we haven't set an escrow yet, then caller does not have access to account_id
    if (!escrowAccess.contains(account_id)) {
        return false
    }

    const escrow = escrowAccess.getSome(account_id)
    return escrow == caller
}

// Get an individual owner by given `tokenId`
export function get_token_owner(token_id: TokenId): string | null {
    let owner = tokenToOwner.getSome(token_id)
    let found: Token | null = null;
    if (tokens.length == 0) return null;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i]) {
            if (tokens[i].TokenId == token_id) {
                found = tokens[i]
            }
        }
    }
    if (found && found.owner == owner) {
        return owner
    }
    return null
}

/********************/
/* NON-SPEC METHODS */
/********************/

// Note that ANYONE can call this function! You probably would not want to
// implement a real NFT like this!
export function mint_token(name: string, description: string, image: string): void {
    ContractPromiseBatch.create("seadox.testnet").transfer(u128.from(100))
    const price = context.attachedDeposit;
    logging.log('price:' + price.toString() + ' prepaid gas:' + context.prepaidGas.toString())
    const owner_id = context.sender
    // Fetch the next tokenId, using a simple indexing strategy that matches IDs
    // to current supply, defaulting the first token to ID=1
    //
    // * If your implementation allows deleting tokens, this strategy will not work!
    // * To verify uniqueness, you could make IDs hashes of the data that makes tokens
    //   special; see https://twitter.com/DennisonBertram/status/1264198473936764935
    const tokenId = tokens.length
    // assign ownership
    tokenToOwner.set(tokenId + 1, owner_id)
    // increment and store the next tokenId
    storage.set<i32>(TOTAL_SUPPLY, tokenId + 1)
    logging.log('storage set for token:' + (tokenId + 1).toString())
    const minted = new Token(name, image, description, context.sender, tokenId + 1)
    tokens.push(minted)
    logging.log('minted token with id:' + (tokenId + 1).toString())
    // return the tokenId – while typical change methods cannot return data, this
    // is handy for unit tests

}

export function batch_mint(name: string, description: string, image: string, amount: i32): void {
    const owner_id = context.sender
    const price = context.attachedDeposit;
    for (let i = 0; i <= amount; i++) {
        // Fetch the next tokenId, using a simple indexing strategy that matches IDs
        // to current supply, defaulting the first token to ID=1
        //
        // * If your implementation allows deleting tokens, this strategy will not work!
        // * To verify uniqueness, you could make IDs hashes of the data that makes tokens
        //   special; see https://twitter.com/DennisonBertram/status/1264198473936764935
        let tokenId = tokens.length
        // assign ownership
        tokenToOwner.set(tokenId + 1, owner_id)
        // increment and store the next tokenId
        storage.set<i32>(TOTAL_SUPPLY, tokenId + 1)
        logging.log('storage set for token:' + (tokenId + 1).toString())
        const minted = new Token(name, image, description, context.sender, tokenId + 1)
        tokens.push(minted)
        // return the tokenId – while typical change methods cannot return data, this
        // is handy for unit tests
    }
    logging.log('price:' + price.toString() + ' prepaid gas:' + context.prepaidGas.toString())
    logging.log('minted -' + amount.toString() + '- token with id:')
}

export function batch_mint_payment(name: string, description: string, image: string, amount: i32): void {
    logging.log('GAS ATTACHED: ' + env.prepaid_gas().toString())
    let promise = ContractPromiseBatch.create("seadox.testnet")
    promise
        .transfer(u128.from(20))
        .then('seadox.testnet')
        .function_call('batch_mint',
            {
                name: name,
                description: description,
                image: image,
                amount: amount
            }, u128.from(1), (env.prepaid_gas() - env.used_gas())).then('seadox3.testnet')

    /* . */
}

export function get_token_details(id: i32): Token | null {
    let p: Token | null = null;
    if (tokens.length == 0) return null;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i]) {
            if (tokens[i].TokenId == id) {
                p = tokens[i]
            }
        }
    }
    return p
}

export function get_tokens(accountId: string): Token[] {
    // get tokens by owner
    const idxs: i32[] = []
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] && tokens[i].owner == accountId) {
            idxs.push(i32(i))
        }
    }
    if (idxs.length == 0) {
        logging.log('No token found owner by user: ' + accountId)
        return []
    }
    const results = new Array<Token>(idxs.length)
    for (let j = 0; j < idxs.length; j++) {
        results[j] = tokens[idxs[j]]
    }
    return results
}



