import { createApp } from 'vue';
import VNetworkGraph from 'v-network-graph';
import 'v-network-graph/lib/style.css';
import App from './App.vue';

createApp(App).use(VNetworkGraph).mount('#app');
