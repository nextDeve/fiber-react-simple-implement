import { ELEMENT_TEXT } from './constants'
import { scheduleRoot, useReducer, useState } from './scheduler';
import { Update } from './updateQueue'
/**
 * 
 * @param {*} type 
 * @param {*} props 
 * @param  {...any} childrens 
 */
function createElement(type, config, ...children) {
    delete config.__self;
    delete config.__source;
    return {
        type,
        props: {
            ...config,
            children: children.map(child => {
                return typeof child === 'object' ? child : {
                    type: ELEMENT_TEXT,
                    props: { text: child, children: [] }
                };
            })
        }
    }
}
class Component {
    constructor(props) {
        this.props = props;
    }
    setState(payload) { //可能是对象，也可能是函数
        let updated = new Update(payload);
        //updateQueue放在类组件对应的fiber节点上 internalFiber
        this.internalFiber.updateQueue.enqueueUpdate(updated);
        scheduleRoot();//从根节点开始调度
    }
}
Component.prototype.isReactComponent = true;//类组件

const React = {
    createElement,
    Component,
    useReducer,
    useState
}

export default React;
