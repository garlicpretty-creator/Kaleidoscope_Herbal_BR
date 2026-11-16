import {ItemStack} from '@minecraft/server';
import {id} from '../data/herbs.js';
import {creative,hand,damageTool} from './items.js';
import {emitEvt} from './bus.js';
export function handleGinsengBreak(event){
 if(event.brokenBlockPermutation.type.id!==id('wild_ginseng')||creative(event.player))return;
 // Bedrock match_tool does not match an absent tool, even with filter_none.
 // Held tools remain entirely loot-table driven; this event handles the bare hand only.
 if(!event.itemStackBeforeBreak)event.dimension.spawnItem(new ItemStack(id('broken_ginseng_root')),event.block.center());
 if(event.itemStackBeforeBreak?.typeId===id('herbal_trowel'))damageTool(event.player,hand(event.player));
 emitEvt('ginseng_dug',event.player,{whole:event.itemStackBeforeBreak?.typeId===id('herbal_trowel')});
}
