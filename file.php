<?php
$path = $_GET["dir"];
$files = scandir($path);
unset($files[0],$files[1]);
$json = array();
foreach($files as $file)
{
	array_push($json,$file);
	if (pathinfo($path."/".$file)["extension"])
	{
		array_push($json,pathinfo($path."/".$file)["extension"]);
	}
	else
	{
		array_push($json,"/");
	}
	
}
echo json_encode($json);
?>
