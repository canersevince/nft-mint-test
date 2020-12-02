import {PersistentVector} from 'near-sdk-as'

@nearBindgen
export class Token {
    constructor(public name: string,
                public image: string,
                public description: string,
                public owner: string,
                public TokenId: i32) {
    }

    updateOwner(newOwner: string): void {
        this.owner = newOwner
    }
}

export const tokens = new PersistentVector<Token>('z')
