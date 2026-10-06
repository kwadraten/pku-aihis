import {Component,h,Prop} from '@stencil/core';
@Component({tag:'frbr-split',shadow:false})
export class FrbrSplit {@Prop() active=true;render(){return <mermaid-diagram diagram="capital"/>;}}
