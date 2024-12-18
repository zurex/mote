'use server';

import { redirect } from "next/navigation";
import { verifyToken } from "mote/app/lib/dal";
import { ICollectionSchema } from "mote/platform/request/common/collection";
import { collectionCreator } from "mote/server/commands/collectionCommands";

export async function createCollectionAction(values: ICollectionSchema) {
    const auth = await verifyToken();

    const collection = await collectionCreator({...values, userId: auth.userId, description: undefined});

    redirect(`/collection/${collection.id}`);
}