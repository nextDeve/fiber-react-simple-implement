import { TAG_ROOT } from './constants'
import { scheduleRoot } from './scheduler'
/**
 * 
 * @param {*} element 
 * @param {*} container 
 */
function render(element, container) {
    let rootFiber = {
        tag: TAG_ROOT,//每个Fiber会有一个tag,此元素类型
        stateNode: container, //一般情况下，如果这个元素是一个原生节点的话，stateNode指向真实DOM元素
        props: {
            //props.children是一个数组，里面放的是react元素 虚拟DOM 后面会根据每个React元素创建对应的Fiber
            children: [element] //这个Fiber的属性对象children属性，里面放的是要渲染的元素
        }
    }
    scheduleRoot(rootFiber);
}
const ReactDom = {
    render
}
export default ReactDom;
/**
 * reconciler
 * schedule
 */