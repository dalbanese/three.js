//intercept three.js loading and retrieve files via the tar loader instead... then pass along to the three.js loader.

function ssLoad( url, callback, urlbase){
	var ssBin;
	var ssJpg;
	var materials;
	F = MultiFile.load(url, function(xhr) {
		this.files.forEach(function(f) {
		  if (f.data.substring(0,8) == "Three.js" && f.filename.substring(f.filename.length-3) == "bin"){
			  ssBin = f.data;
		  }
		  if (f.filename.substring(f.filename.length-2) == "js"){	
			var myData = JSON.parse(f.data);
			materials = myData.materials,buffers = myData.buffers;			  
		  }
		  if (f.filename.substring(f.filename.length-3) == "jpg"){
			 ssJpg = f.toDataURL();
		  }
		});
		loader.createBinModel(ssBin,callback,urlbase,materials,ssJpg);
	  });
}


