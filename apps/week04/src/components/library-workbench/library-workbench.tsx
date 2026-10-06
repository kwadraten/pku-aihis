import {Component,h,Prop} from '@stencil/core';
import {pageFromSlide} from '../../lib/patchouli-pages';
@Component({tag:'library-workbench',shadow:false})
export class LibraryWorkbench {
 @Prop() pageId='D04';@Prop() active=false;@Prop() embedded=false;@Prop() contentOnly=false;@Prop() searchPage=false;@Prop() session:Record<string,any>;
 render(){return <patchouli-app initialPage={this.searchPage?'search':pageFromSlide(this.pageId)} active={this.active}/>;}
}
