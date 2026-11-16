import {registerComponents} from './custom_components/index.js';
import {startEvents} from './events/lifecycle.js';
import {startCookeryBridge} from './api/cookeryBridge.js';
import {startTavernBridge} from './api/tavernBridge.js';
registerComponents();
startEvents();
startCookeryBridge();
startTavernBridge();
