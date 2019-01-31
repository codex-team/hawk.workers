<?php 
  require __DIR__ . '/vendor/autoload.php';

  $dotenv = Dotenv\Dotenv::create(__DIR__);
  $dotenv->load();

  function main() {
    \Hawk\HawkCatcher::instance($_ENV['CATCHER_TOKEN'], $_ENV['CATCHER_URL']);
    \Hawk\HawkCatcher::enableHandlers();
    $log = new Monolog\Logger('name');

    try {
      throw new Exception('Error Processing Request', 1);
    } catch (Exception $e) {
      \Hawk\HawkCatcher::catchException($e);
    }
  }

  $comand = isset($argv[1])? $argv[1] : 'once';

  if ($comand == 'once') {
    main();
  } elseif ($comand == 'interval') {
    $sec = isset($argv[2])? (int)$argv[2] : 1;
    echo var_dump($sec);
    setInterval(function() {
      main();
    }, $sec);
  }

  function setInterval($f, $seconds)
  {
      while(true)
      {
        $f();
        sleep($seconds);
      }
  }
?>