import test from 'tape';
import spok from 'spok';
import {
  createNewDistributorInstruction,
  MerkleDistributorAccountData,
  NewDistributorInstructionAccounts,
  NewDistributorInstructionArgs,
  PROGRAM_ID,
} from '../src/mpl-gumdrop';
import {
  LOCALHOST,
  airdrop,
  PayerTransactionHandler,
  assertTransactionSummary,
} from '@metaplex-foundation/amman';
import { addressLabels, killStuckProcess } from './utils';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

killStuckProcess();

test('newDistributor', async (t) => {
  const [base, basePriv] = addressLabels.genKeypair('base');
  const [payer, payerPriv] = addressLabels.genKeypair('payer');

  const [distributor, bump] = await PublicKey.findProgramAddress(
    [Buffer.from('MerkleDistributor'), base.toBuffer()],
    PROGRAM_ID,
  );
  addressLabels.addLabel('distributor', distributor);

  const accounts: NewDistributorInstructionAccounts = {
    base,
    distributor,
    payer,
  };

  const [temporal] = addressLabels.genKeypair('temporal');
  // TODO(thlorenz): this should be the merkle tree root
  const root = Buffer.from(payer.toBytes()).toJSON().data;

  const args: NewDistributorInstructionArgs = {
    bump,
    root,
    temporal,
  };
  const ix = createNewDistributorInstruction(accounts, args);
  const transaction = new Transaction().add(ix);

  const connection = new Connection(LOCALHOST, 'confirmed');
  // TODO(thlorenz): this account should be fixed size
  // const rentExcemption = MerkleDistributorAccountData.getMinimumBalanceForRentExemption(connection)
  await airdrop(connection, payer, 1);

  const transactionHandler = new PayerTransactionHandler(connection, payerPriv);
  // TODO(thlorenz): would be nice to have a `getSigners` method on the created
  // instruction
  const res = await transactionHandler.sendAndConfirmTransaction(transaction, [basePriv]);
  assertTransactionSummary(t, res.txSummary, { msgRx: [/Instruction: NewDistributor/i] });

  const accountInfo = await connection.getAccountInfo(distributor);
  const [info] = MerkleDistributorAccountData.fromAccountInfo(accountInfo);
  spok(t, info.pretty(), {
    $topic: 'Distributor AccountInfo',
    base: base.toBase58(),
    temporal: temporal.toBase58(),
    root,
    bump,
  });

  t.end();
});
