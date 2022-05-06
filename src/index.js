import React from './react'
import ReactDOM from './react-dom'
class Cunter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { number: 0 };
  }
  handelClick = () => {
    this.setState({ number: this.state.number + 1 })
  }
  render() {
    return (
      <div id='counter'>
        <h1>计数：{this.state.number}</h1>
        <button onClick={this.handelClick}>+1</button>
      </div>
    )
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return state + 1
    default:
      return state;
  }
}
function FunctionConter() {
  const [countState, dispatch] = React.useReducer(reducer, 100)
  const [count, setCount] = React.useState(0)
  return (
    <div id='counter'>
      <h1>计数：{countState}</h1>
      <h1>计数：{count}</h1>
      <button onClick={() => { dispatch({ type: 'ADD' }); setCount(count + 1) }}>+1</button>
    </div>
  )
}
ReactDOM.render(<FunctionConter name='zpc'></FunctionConter>, document.getElementById('root'))
/* ReactDOM.render(<Cunter name='zpc'></Cunter>, document.getElementById('root'))  */