import {
    ELEMENT_TEXT, PLACEMENT, UPDATE, DELETION,
    TAG_TEXT, TAG_ROOT, TAG_HOST, TAG_CLASS, TAG_FUNCTION
} from './constants'
import { UpdateQueue, Update } from './updateQueue';
import { setProps } from './utils'
/**
 * 从根节点渲染和调度
 * 两个阶段
 * diff阶段 对比新旧的虚拟dom，进行增量 更新 创建 ，render阶段
 * 这个阶段比较费事件，我们可以对任务进行拆分，拆分的维度虚拟Dom，此阶段可以暂停
 * render阶段成果是effect list 知道哪些节点更新  删除 增加
 * render阶段两个任务1.根据Vdom 生成fiber树 2.收集effectList
 * commit阶段，进行创建DOM更新创建阶段，此阶段不能暂停。
 */
let nextUnitOfWork = null; //下一个工作单元
let workInProgressRoot = null; // RootFiber应用根结点，正在构建的fiber树
let currentRoot = null; //当前fiber树根节点，已经渲染到页面上的
let deletions = []; //删除的节点我们不放在effect list里面
let workInProgressFiber = null; //正在工作中的fiber
let hookIndex = 0; //hooks索引
/**
 * 开始调度
 * @param {*} rootFiber 
 */
export function scheduleRoot(rootFiber) { //对象 tag，stateNode，props:{children:[element]}
    //保证内存中始终只有一个或两个fiber树
    if (currentRoot && currentRoot.alternate) { //第二次之后的更新
        workInProgressRoot = currentRoot.alternate;
        workInProgressRoot.alternate = currentRoot;
        if (rootFiber) workInProgressRoot.props = rootFiber.props;
    }
    //至少已经渲染过一次了
    else if (currentRoot) { //第一次更新
        //双缓存机制，复用之前的fiber树
        if (rootFiber) {
            rootFiber.alternate = currentRoot;
            workInProgressRoot = rootFiber;
        } else {
            workInProgressRoot = {
                ...currentRoot,
                alternate: currentRoot
            }
        }

    } else {//第一次渲染
        workInProgressRoot = rootFiber
    }
    //清空
    workInProgressRoot.firstEffect = workInProgressRoot.lastEffect = workInProgressRoot.nextEffect = null;
    nextUnitOfWork = workInProgressRoot;
}
/**
 * 在完成时要收集有副作用的fiber,然后组成effect list
 * 每个fiber 有两个属性，firstEffect指向第一个有副作用的子fiber，lastEffect指向最后一个有副作用的字fiber
 *  中间的nextEffect做成一个单链表
 * @param {*} currentFiber 
 */
function completeUnitOfWork(currentFiber) {
    let returnFiber = currentFiber.return;
    if (returnFiber) {
        ////把自己儿子的effect挂到父结
        if (!returnFiber.firstEffect) {
            returnFiber.firstEffect = currentFiber.firstEffect
        }
        if (currentFiber.lastEffect) {
            if (returnFiber.lastEffect) {
                returnFiber.lastEffect.nextEffect = currentFiber.firstEffect
            }
            returnFiber.lastEffect = currentFiber.lastEffect
        }
        //// 把自己挂到父结点上
        const effectTag = currentFiber.effectTag;
        if (effectTag) { //自己有副作用
            if (returnFiber.lastEffect) {
                returnFiber.lastEffect.nextEffect = currentFiber;
            } else {
                returnFiber.firstEffect = currentFiber;
            }
            returnFiber.lastEffect = currentFiber;
        }
    }
}
/**
 * 为每一个child创建fiber
 * @param {*} currentFiber 
 * @param {*} newChildren 
 */
function reconcileChildren(currentFiber, newChildren) {
    let newChildIndex = 0;//新子节点的索引
    //如果说currentFiber 有alternate 并且alternate有child
    let oldFiber = currentFiber.alternate && currentFiber.alternate.child;
    let prevSibling; //上一个新的子fiber
    while (newChildIndex < newChildren.length || oldFiber) {
        let newChild = newChildren[newChildIndex] //取出虚拟Dom
        let newFiber;
        //这里需要
        const sameType = oldFiber !== undefined && newChild && oldFiber.type === newChild.type;
        let tag;
        if (newChild !== undefined) {
            if (newChild.type === ELEMENT_TEXT) {
                tag = TAG_TEXT;
            } else if (typeof newChild.type === 'string') {
                tag = TAG_HOST;
            } else if (typeof newChild.type === 'function' && newChild.type.prototype.isReactComponent) {
                tag = TAG_CLASS;
            } else if (typeof newChild.type === 'function' && !newChild.type.prototype.isReactComponent) {
                tag = TAG_FUNCTION;
            }
        }
        if (sameType) { //说明老fiber和新的虚拟dom类型一样，可以复用老的dom节点，更新即可
            //至少已经更新过一次了
            if (oldFiber.alternate) {
                newFiber = oldFiber.alternate;
                newFiber.props = newChild.props;
                newFiber.effectTag = UPDATE;
                newFiber.nextEffect = newFiber.firstEffect = newFiber.lastEffect = null;
                newFiber.alternate = oldFiber;
            } else {
                newFiber = {
                    tag: oldFiber.tag,
                    type: oldFiber.type,
                    props: newChild.props,
                    stateNode: oldFiber.stateNode,//这时还没有创建dom元素,
                    alternate: oldFiber, //让新fiber的alternate指向老的fiber节点
                    return: currentFiber,//父fiber
                    effectTag: UPDATE,//副作用标识
                    nextEffect: null,//effect list 也是一个单链表
                }
            }
            if (typeof oldFiber.type === 'function' && oldFiber.type.prototype.isReactComponent) {
                newFiber.updateQueue = oldFiber.updateQueue;
            }
        } else {
            if (newChild) {
                newFiber = {
                    tag,
                    type: newChild.type,
                    props: newChild.props,
                    stateNode: null,//这时还没有创建dom元素,
                    return: currentFiber,//父fiber
                    effectTag: PLACEMENT,//副作用标识
                    nextEffect: null,//effect list 也是一个单链表
                    //effect list顺序和完成顺序是一样的，但是只放那些有副作用的节点（更新、删除、新增）
                }
                if (typeof newChild.type === 'function' && newChild.type.prototype.isReactComponent) {
                    newFiber.updateQueue = new UpdateQueue();
                }
            }
            if (oldFiber) {
                oldFiber.effectTag = DELETION;
                deletions.push(oldFiber)
            }
        }
        //排序最后的元素没有sibling
        if (newFiber) {
            if (newChildIndex === 0) { //当前索引为0，第一个子元素
                currentFiber.child = newFiber;
            } else {
                prevSibling.sibling = newFiber; //兄弟节点，构建链表
            }
            prevSibling = newFiber //构建链表
        }
        newChildIndex++;
        if (oldFiber) { //oldFiber向后移动
            oldFiber = oldFiber.sibling;
        }
    }
}


/**
 * 双缓存机制，第一次commit时只有rootFiber有effectTag为PLACEMENT
 * 这里为了实现  与源码不太一样
 */
function commitRoot() {
    deletions.forEach(commitWork);//执行effect list之前先把该删除的元素删除
    let currentFiber = workInProgressRoot.firstEffect;
    while (currentFiber) {
        if (currentFiber.tag !== TAG_CLASS) {
            commitWork(currentFiber);
        }
        currentFiber = currentFiber.nextEffect;
    }
    deletions.length = 0;
    currentRoot = workInProgressRoot;//双缓存机制
    workInProgressRoot = null
}
/**
 * 将子结点添加到父节点中
 * @param {*} currentFiber 
 */
function commitWork(currentFiber) {
    if (!currentFiber) return;
    let returnFiber = currentFiber.return;
    while (returnFiber.tag !== TAG_HOST
        && returnFiber.tag !== TAG_ROOT
        && returnFiber.tag !== TAG_TEXT
    ) {
        returnFiber = returnFiber.return;
    }
    let returnDOM = returnFiber.stateNode;
    if (currentFiber.effectTag === PLACEMENT) {
        let nextFiber = currentFiber;
        while (
            nextFiber.tag !== TAG_HOST
            && nextFiber.tag !== TAG_ROOT
            && nextFiber.tag !== TAG_TEXT
        ) {
            nextFiber = nextFiber.child
        }
        returnDOM.appendChild(nextFiber.stateNode);
    } else if (currentFiber.effectTag === DELETION) {
        commitDeletion(currentFiber, returnDOM);
        returnDOM.removeChild(currentFiber.stateNode);
    } else if (currentFiber.effectTag === UPDATE) {
        if (currentFiber.type === ELEMENT_TEXT) {
            if (currentFiber.alternate.props.text !== currentFiber.props.text)
                currentFiber.stateNode.textContent = currentFiber.props.text;
        } else {
            updateDOM(currentFiber.stateNode, currentFiber.alternate.props, currentFiber.props);
        }
    }
    currentFiber.effectTag = null;
}
/**
 * 
 * @param {*} currentFiber 
 * @param {*} returnDOM 
 */
function commitDeletion(currentFiber, returnDOM) {
    if (currentFiber.tag === TAG_TEXT || currentFiber.tag === TAG_HOST) {
        returnDOM.removeChild(currentFiber.stateNode);
    } else {
        commitDeletion(currentFiber.child, returnDOM);
    }
}
/**
 * 更新原生节点
 * @param {*} currentFiber 
 */
function updateHost(currentFiber) {
    if (!currentFiber.stateNode) {//此fiber没有创建dom节点
        currentFiber.stateNode = createDom(currentFiber);
    }
    const newChildren = currentFiber.props.children;
    reconcileChildren(currentFiber, newChildren);
}
/**
 * 
 * @param {*} currentFiber 
 */
function updateHostText(currentFiber) {
    if (!currentFiber.stateNode) {//此fiber没有创建dom节点
        currentFiber.stateNode = createDom(currentFiber);
    }
}
/**
 * 根据fiber创建真实dom
 * @param {*} currentFiber 
 */
function createDom(currentFiber) {
    if (currentFiber.tag === TAG_TEXT) {
        return document.createTextNode(currentFiber.props.text);
    } else if (currentFiber.tag === TAG_HOST) {
        let stateNode = document.createElement(currentFiber.type);
        updateDOM(stateNode, {}, currentFiber.props);
        return stateNode;
    }
}
function updateDOM(stateNode, oldProps, newProps) {
    if (stateNode && stateNode.nodeType !== undefined) {
        setProps(stateNode, oldProps, newProps);
    }
}
/**
 * 处理rootFiber
 * @param {*} currentFiber 
 */
function updateHostRoot(currentFiber) {
    //1.先处理自己，如果是一个原生节点，创建真实DOM 2.创建子fiber
    let newChildren = currentFiber.props.children; //[element]
    reconcileChildren(currentFiber, newChildren);
}
function updateClassComponent(currentFiber) {
    if (!currentFiber.stateNode) {//类组件的stateNode是类组件的实例
        //new 一个类组件实例，挂载到fiber上
        currentFiber.stateNode = new currentFiber.type(currentFiber.props);
        currentFiber.stateNode.internalFiber = currentFiber;
        currentFiber.updateQueue = new UpdateQueue();
    }
    currentFiber.stateNode.state = currentFiber.updateQueue.forceUpdate(currentFiber.stateNode.state);
    let newChildren = [currentFiber.stateNode.render()];
    reconcileChildren(currentFiber, newChildren);
}
/**
 * 
 * @param {*} currentFiber 
 */
function updateFunctionComponent(currentFiber) {
    workInProgressFiber = currentFiber;
    hookIndex = 0;
    workInProgressFiber.hooks = [];
    const newChildren = [currentFiber.type(currentFiber.props)];
    reconcileChildren(currentFiber, newChildren)
}
/**
 * 开始创建fiber树
 * 1.创建真实Dom元素
 * 2.创建子Fiber
 * @param {*} currentFiber 
 */
function beginWork(currentFiber) {
    if (currentFiber.tag === TAG_ROOT) {
        updateHostRoot(currentFiber);
    } else if (currentFiber.tag === TAG_TEXT) {
        updateHostText(currentFiber);
    } else if (currentFiber.tag === TAG_HOST) {
        updateHost(currentFiber);
    } else if (currentFiber.tag === TAG_CLASS) {
        updateClassComponent(currentFiber);
    } else if (currentFiber.tag === TAG_FUNCTION) {
        updateFunctionComponent(currentFiber);
    }
}
/**
 * 
 * @param {*} currentFiber 
 */
function performUnitOfWork(currentFiber) {
    beginWork(currentFiber);
    if (currentFiber.child) {
        return currentFiber.child
    }
    while (currentFiber) {
        completeUnitOfWork(currentFiber);//没有儿子，让自己完成
        if (currentFiber.sibling) {//有兄弟，返回兄弟节点
            return currentFiber.sibling;
        }
        currentFiber = currentFiber.return; //找到父节点，让父节点完成
    }
}
/**
 * 循环执行工作
 */
function workLoop(deadline) {
    let shouldYield = false;//是否要让出事件片或者说控制权
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork); //执行完一个任务后
        shouldYield = deadline.timeRemaining() < 1; //没有事件的话，让出控制权
    }
    if (!nextUnitOfWork && workInProgressRoot) {
        commitRoot();
    }
    //不管有没有任务，请求浏览器再次调度  每一帧都要执行一次workLoop
    requestIdleCallback(workLoop, { timeout: 500 });
}
// react告诉浏览器，我现在有任务，在空闲时执行
// 有一个优先级的概念，expirationTime
requestIdleCallback(workLoop, { timeout: 500 });

/**
 * 
 * @param {*} reducer 
 * @param {*} initState 
 */
export function useReducer(reducer, initState) {
    let oldHook = workInProgressFiber.alternate && workInProgressFiber.alternate.hooks
        && workInProgressFiber.alternate.hooks[hookIndex]
    let newHook = oldHook;
    if (oldHook) {
        oldHook.state = oldHook.updateQueue.forceUpdate(oldHook.state);
    } else {
        newHook = {
            state: initState,
            updateQueue: new UpdateQueue()
        };
    }
    const dispatch = actionOrState => {
        let payload = reducer ? reducer(newHook.state, actionOrState) : actionOrState
        newHook.updateQueue.enqueueUpdate(
            new Update(payload)
        );
        scheduleRoot();
    }
    workInProgressFiber.hooks[hookIndex++] = newHook;
    return [newHook.state, dispatch];
}

export function useState(initState) {
    return useReducer(null, initState);
}