import {Component,h,Prop} from '@stencil/core';
@Component({tag:'pdf-flow-split',shadow:false})
export class PdfFlowSplit {@Prop() active=true;render(){return <metadata-split navigation="concepts" conceptPage="D06" active={this.active}/>;}}
