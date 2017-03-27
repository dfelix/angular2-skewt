import { Component, AfterViewInit, OnChanges, Input, ViewChild, ElementRef } from '@angular/core';
import * as D3 from 'd3';

@Component({
  selector: 'app-skewt',
  styles: [`
    .d3-skewt {  font: 12px Arial;}
    * /deep/ .skewt-bg {border: 1px solid yellow; }
    * /deep/ .axis path,
    * /deep/ .axis line { fill: none; stroke: #000; stroke-width: 1px; shape-rendering: crispEdges;}
    * /deep/ .x.axis path {  }
    * /deep/ .y.axis path {  }
    * /deep/ .axis { fill: #000; }
    * /deep/ .y.axis { font-size: 13px; }
    * /deep/ .y.axis.hght { font-size: 9px; fill: red;}
    * /deep/ .x.axis { font-size: 13px; }
    * /deep/ .y.axis.tick text { display: none; }
    * /deep/ .temp { fill: none; stroke: red; stroke-width: 3px;}
    * /deep/ .dwpt { fill: none; stroke: green; stroke-width: 3px;}
    * /deep/ .skline   { stroke-width: 1.8px; opacity: 0.8;}
    * /deep/ .mean     { stroke-width: 2.5px; }
    * /deep/ .tempzero { stroke: #dfdfdf; fill: none; stroke: #aaa; stroke-width: 1.25px;}
    * /deep/ .gridline { stroke: #dfdfdf; stroke-width: 0.75px; fill: none;}
    * /deep/ .windbarb { stroke: #000; stroke-width: 0.75px; fill: none;}
    * /deep/ .flag { fill: #000; }
    * /deep/ .overlay { fill: none; pointer-events: all;}
    * /deep/ .focus.tmpc circle { fill: red;   stroke: none; }
    * /deep/ .focus.dwpc circle { fill: green; stroke: none; }
    * /deep/ .focus text { font-size: 12px; }
  `],
  template: '<div class="d3-skewt" #chart (window:resize)="onResize($event)"></div>'
})

export class SkewtComponent implements AfterViewInit {
  @ViewChild('chart') private chartContainer: ElementRef;
  @Input() private data: Array<any>;
  @Input() private unit: string;

  private htmlElement: HTMLElement;
  private host;         //html element
  private svg;          //svg main container
  private container;    //container for background, lines and barbs
  private background;   //container for clipping path, skew-t temp lines, Logarithmic pressure lines, dry adiabats and axes
  private tempAxis;     //container for temperature axis
  private pressureAxis; //container for pressure axis
  private skewtlines;   //container for plotted temperature lines
  private barbs;        //container for wind barbs
  private margin = { top: 20, right: 20, bottom: 40, left: 40 };  // conteiner margins
  private width;        //chart width
  private height;       //chart height
  private xScale;       //function to get x scale value between -45, 50 ºC
  private yScale;       //function to get y scale value between 1050 and 100 mb
  private topPressure = 100;
  private basePressure = 1050;
  private plines = [1000, 850, 700, 500, 300, 200, 100];
  private pticks = [950, 900, 800, 750, 650, 600, 550, 450, 400, 350, 250, 150];
  private deg2rad = (Math.PI / 180);
  private tan = Math.tan(55 * this.deg2rad);
  private bisectTemp = D3.bisector((d: any) => { return d.press; }).left; // bisector function for tooltips

  constructor() {
  }

  ngAfterViewInit() {
    this.htmlElement = this.chartContainer.nativeElement;
    this.host = D3.select(this.htmlElement);
    //this.setup()
  }

  ngOnChanges(): void {
    if (!this.data || !this.host) return;
    this.setup();
    this.buildSVG();
    this.makeBarbTemplate();
    this.drawBackground();
    this.plot(this.data);
  }

  onResize(event) {
    this.setup();
    this.buildSVG();
    this.drawBackground();
    this.makeBarbTemplate();
    this.plot(this.data);
  }

  private setup(): void {
    this.width = this.htmlElement.clientWidth - this.margin.left - this.margin.right;
    this.height = this.width; //to review
    this.xScale = D3.scaleLinear().range([0, this.width]).domain([-45, 50]);
    this.yScale = D3.scaleLog().range([0, this.height]).domain([this.topPressure, this.basePressure]);

    if(!this.unit || (this.unit != "kmh" && this.unit !="kt" && this.unit!="ms"))
    {
        this.unit = "kt"; 
        console.log("Unit is invalid or not defined. Using knot as default.");
    }
  }

  private buildSVG(): void {
    this.host.select("svg").remove();
    this.svg = this.host.append('svg')
      .attr('id', 'svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.width + this.margin.left + this.margin.right); //same as height
    this.container = this.svg.append("g")
      .attr("id", "container")
      .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');
    this.background = this.container.append("g")
      .attr("id", "skewt-bg")
      .attr("class", "skewt-bg");

    //init skewt and barb containers
    this.skewtlines = this.container.append("g").attr("class", "skewt"); // put skewt lines in this group
    this.barbs = this.container.append("g").attr("class", "windbarb"); // put barbs in this group	
  }

  private drawBackground(): void {
    // Add clipping path
    this.background.append("clipPath")
      .attr("id", "clipper")
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", this.width)
      .attr("height", this.height);

    // Draw right border
    this.background.append("line")
      .attr("x1", this.width - 0.5)
      .attr("x2", this.width - 0.5)
      .attr("y1", 0)
      .attr("y2", this.height)
      .attr("class", "gridline");

    // create array for dry adiabats
    var data = [];
    var pressurePoints = D3.range(this.topPressure, this.basePressure + 1, 10);
    var dryadiabatPoints = D3.range(-30, 240, 20);
    for (var i = 0; i < dryadiabatPoints.length; i++) {
      var point = [];
      for (var j = 0; j < pressurePoints.length; j++) {
        point.push(dryadiabatPoints[i]);
      }
      data.push(point);
    }

    var dryline = D3.line()
      .x((d: any, i: any) => { return this.xScale((273.15 + d) / Math.pow((1000 / pressurePoints[i]), 0.286) - 273.15) + (this.yScale(this.basePressure) - this.yScale(pressurePoints[i])) / this.tan })
      .y((d: any, i: any) => { return this.yScale(pressurePoints[i]) });

    // Draw dry adiabats 
    this.background.selectAll("dryadiabatline")
      .data(data)
      .enter().append("path")
      .attr("class", "gridline")
      .attr("clip-path", "url(#clipper)")
      .attr("d", dryline);

    // temperature lines
    this.background.selectAll("templine")
      .data(D3.range(-100, 45, 10))
      .enter().append("line")
      .attr("x1", (d: any) => this.xScale(d) - 0.5 + (this.yScale(this.basePressure) - this.yScale(100)) / this.tan)
      .attr("x2", (d: any) => this.xScale(d) - 0.5)
      .attr("y1", 0)
      .attr("y2", this.height)
      .attr("class", (d: any) => d == 0 ? "tempzero" : "gridline")
      .attr("clip-path", "url(#clipper)");

    // Logarithmic pressure lines
    this.background.selectAll("pressureline")
      .data(this.plines)
      .enter().append("line")
      .attr("x1", 0)
      .attr("x2", this.height)
      .attr("y1", (d: any) => this.yScale(d))
      .attr("y2", (d: any) => this.yScale(d))
      .attr("class", "gridline");

    //temperature axis
    this.tempAxis = D3.axisBottom(this.xScale)
      .tickFormat(D3.format(".0d"))
      .tickSize(0)
      .ticks(10);
    this.background.append('g')
      .call(this.tempAxis)
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + this.height + ')');

    //pressure axis
    this.pressureAxis = D3.axisLeft(this.yScale)
      .tickValues(this.plines)
      .tickFormat(D3.format(".0d"))
      .tickSize(0);
    this.background.append('g')
      .call(this.pressureAxis)
      .attr('class', 'y axis')
      .append('text')
      .attr('transform', 'translate(-0.5,0)');
  }

  plot(data: Array<any>): void {
    this.skewtlines.selectAll("path").remove(); //clear previous paths from skew
    this.barbs.selectAll("use").remove(); //clear previous paths from barbs

    if (data.length == 0) return;

    //obj to array cast - needs revistion
    var result = data.filter(function (d) { return (d.temp > -1000 && d.dwpt > -1000); });
    var lines = [];
    lines.push(result);

    // draw temperature line
    var temperatureLine = D3.line()
      .x((d: any, i: any) => { return this.xScale(d.temp) + (this.yScale(this.basePressure) - this.yScale(d.press)) / this.tan; })
      .y((d: any, i: any) => { return this.yScale(d.press); });

    this.skewtlines.selectAll("skewtlines")
      .data(lines)
      .enter().append("path")
      .attr("class", (d: any, i: any) => { return (i < 10) ? "temp skline" : "temp mean" })
      .attr("clip-path", "url(#clipper)")
      .attr("d", temperatureLine);

    // draw dew point line
    var dewpointLine = D3.line()
      .x((d: any, i: any) => { return this.xScale(d.dwpt) + (this.yScale(this.basePressure) - this.yScale(d.press)) / this.tan; })
      .y((d: any, i: any) => { return this.yScale(d.press); });

    this.skewtlines.selectAll("dewlines")
      .data(lines)
      .enter().append("path")
      .attr("class", function (d, i) { return (i < 10) ? "dwpt skline" : "dwpt mean" })
      .attr("clip-path", "url(#clipper)")
      .attr("d", dewpointLine);

    // draw wind barbs 
    var barbs = result.filter((d: any) => { return (d.wdir >= 0 && d.wspd >= 0 && d.press >= this.topPressure); });

    this.barbs.selectAll("barbs")
      .data(barbs).enter().append("use")
      .attr("xlink:href", (d: any, i: any) => { return "#barb" + Math.round(this.convert(d.wspd, "kt") / 5) * 5; }) // 0,5,10,15,... always in kt
      .attr("transform", (d: any, i: any) => { return "translate(" + this.width + "," + this.yScale(d.press) + ") rotate(" + (d.wdir + 180) + ")"; });

    //tooltips
    this.drawToolTips(lines[0]);

  }

  makeBarbTemplate() {
    var speeds = D3.range(5, 105, 5);
    var barbdef = this.container.append('defs');
    var barbsize = 25;

    speeds.forEach((d: any) => {
      var thisbarb = barbdef.append('g').attr('id', 'barb' + d);
      var flags = Math.floor(d / 50);
      var pennants = Math.floor((d - flags * 50) / 10);
      var halfpennants = Math.floor((d - flags * 50 - pennants * 10) / 5);
      var px = barbsize;
      // Draw wind barb stems
      thisbarb.append("line").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", barbsize);
      // Draw wind barb flags and pennants for each stem
      for (var i = 0; i < flags; i++) {
        thisbarb.append("polyline")
          .attr("points", "0," + px + " -10," + (px) + " 0," + (px - 4))
          .attr("class", "flag");
        px -= 7;
      }
      // Draw pennants on each barb
      for (i = 0; i < pennants; i++) {
        thisbarb.append("line")
          .attr("x1", 0)
          .attr("x2", -10)
          .attr("y1", px)
          .attr("y2", px + 4)
        px -= 3;
      }
      // Draw half-pennants on each barb
      for (i = 0; i < halfpennants; i++) {
        thisbarb.append("line")
          .attr("x1", 0)
          .attr("x2", -5)
          .attr("y1", px)
          .attr("y2", px + 2)
        px -= 3;
      }
    });
  }

  drawToolTips(lines) {
    // reverse line order
    var reversedLines = lines.reverse();
    // Draw tooltips
    var tmpcfocus = this.skewtlines.append("g").attr("class", "focus tmpc").style("display", "none");
    tmpcfocus.append("circle").attr("r", 4);
    tmpcfocus.append("text").attr("x", 9).attr("dy", ".35em");

    var dwpcfocus = this.skewtlines.append("g").attr("class", "focus dwpc").style("display", "none");
    dwpcfocus.append("circle").attr("r", 4);
    dwpcfocus.append("text").attr("x", -9).attr("text-anchor", "end").attr("dy", ".35em");

    var hghtfocus = this.skewtlines.append("g").attr("class", "focus").style("display", "none");
    hghtfocus.append("text").attr("x", 0).attr("text-anchor", "start").attr("dy", ".35em");

    var wspdfocus = this.skewtlines.append("g").attr("class", "focus windspeed").style("display", "none");
    wspdfocus.append("text").attr("x", 0).attr("text-anchor", "start").attr("dy", ".35em");

    this.container.append("rect")
      .attr("class", "overlay")
      .attr("width", this.width)
      .attr("height", this.height)
      .on("mouseover", () => { tmpcfocus.style("display", null); dwpcfocus.style("display", null); hghtfocus.style("display", null); wspdfocus.style("display", null); })
      .on("mouseout", () => { tmpcfocus.style("display", "none"); dwpcfocus.style("display", "none"); hghtfocus.style("display", "none"); wspdfocus.style("display", "none"); })
      .on("mousemove", () => {
        var y0 = this.yScale.invert(D3.mouse(this.htmlElement)[1]); // get y value of mouse pointer in pressure space
        var i = this.bisectTemp(lines, y0, 1, lines.length - 1);
        var d0 = lines[i - 1];
        var d1 = lines[i];
        var d = y0 - d0.press > d1.press - y0 ? d1 : d0;
        tmpcfocus.attr("transform", "translate(" + (this.xScale(d.temp) + (this.yScale(this.basePressure) - this.yScale(d.press)) / this.tan) + "," + this.yScale(d.press) + ")");
        dwpcfocus.attr("transform", "translate(" + (this.xScale(d.dwpt) + (this.yScale(this.basePressure) - this.yScale(d.press)) / this.tan) + "," + this.yScale(d.press) + ")");
        hghtfocus.attr("transform", "translate(0," + this.yScale(d.press) + ")");
        tmpcfocus.select("text").text(Math.round(d.temp) + "°C");
        dwpcfocus.select("text").text(Math.round(d.dwpt) + "°C");
        hghtfocus.select("text").text("-- " + Math.round(d.hght) + " m"); 	//hgt or hghtagl ???
        wspdfocus.attr("transform", "translate(" + (this.width - 85) + "," + this.yScale(d.press) + ")");
        wspdfocus.select("text").text(Math.round(this.convert(d.wspd, this.unit) * 10) / 10 + " " + this.unit);
      });
  }

  convert(msvalue, unit) {
    switch (unit) {
      case "kt":
        return msvalue * 1.943844492;
      case "kmh":
        return msvalue * 3.6;
      case "ms":
        return msvalue;
      default:  //m/s
        this.unit = "ms";
        return msvalue;
    }
  }

  public clear(): void {
    this.skewtlines.selectAll("path").remove(); //clear previous paths from skew
    this.barbs.selectAll("use").remove(); //clear previous paths  from barbs
    //must clear tooltips!
    this.container.append("rect")
      .attr("class", "overlay")
      .attr("width", this.width)
      .attr("height", this.height)
      .on("mouseover", () => { return false; })
      .on("mouseout", () => { return false; })
      .on("mousemove", () => { return false; });
  }
}
